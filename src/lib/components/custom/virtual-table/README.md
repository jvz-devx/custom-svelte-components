# Virtual Table

A custom virtual table component for SvelteKit with pretext-based height prediction, optimistic CRUD, and SvelteKit Remote Functions integration.

## Architecture

```
VirtualTable.svelte          Main component — scroll container, header, visible rows
  ├─ virtual-scroller        Pure arithmetic: scroll position → visible row range
  ├─ height-manager          Wraps @chenglou/pretext for DOM-free row height prediction
  ├─ optimistic              Optimistic update/delete overlay with rollback + retry
  ├─ editable-cell           Double-click inline editing with Enter/Escape/blur
  └─ types                   ColumnDef, SortState, query types
```

## Why custom instead of TanStack Virtual?

This component is designed to work with **SvelteKit Remote Functions** where query arguments (offset, limit, sort, filter) change on scroll. TanStack Virtual's `@tanstack/svelte-virtual` would work for the scroll math, but the optimistic update layer needs to be query-independent.

### Why custom optimistic state instead of `.withOverride()`?

Remote Functions' `.withOverride()` ties the optimistic override to a specific query instance (keyed by arguments). In a virtual table, scrolling changes `offset`/`limit`, creating a new query instance. The override is lost on the old instance, causing the optimistic change to flicker — disappearing briefly until the server responds.

Our `createOptimisticState` applies on top of whatever `serverRows` currently is, regardless of which query fetched them. This means:

- **Scroll mid-edit**: optimistic change persists
- **Re-sort mid-edit**: optimistic change persists
- **Re-filter mid-edit**: optimistic change persists (if the row matches the filter)
- **Multiple rapid edits**: overlays stack naturally
- **Failure tracking**: per-field `isPending()` / `isFailed()` for UI indicators
- **Retry**: re-attempt failed operations without re-entering edit mode

For a non-virtual table (no offset/limit changes), `.withOverride()` is simpler and sufficient.

## Usage

### Basic setup with Remote Functions

```ts
// data.remote.ts
import * as v from 'valibot';
import { query, command } from '$app/server';

export const getRows = query(
  v.object({
    offset: v.number(),
    limit: v.number(),
    sort: v.nullable(v.object({ key: v.string(), direction: v.picklist(['asc', 'desc']) })),
    filter: v.string()
  }),
  async ({ offset, limit, sort, filter }) => {
    // fetch from database
  }
);

export const getRowCount = query(v.string(), async (filter) => {
  // return count
});

export const updateRow = command(schema, async ({ id, ...data }) => {
  // update in database
  await requested(getRows, 5).refreshAll();  // single-flight refresh
});
```

```svelte
<script lang="ts">
  import { VirtualTable, createOptimisticState } from '$lib/components/custom/virtual-table';
  import { getRows, getRowCount, updateRow } from './data.remote';

  const optimistic = createOptimisticState<Row>();
  let serverRows = $state<Row[]>([]);
  let rows = $derived(optimistic.applyTo(serverRows));

  async function handleUpdate(row: Row, key: string, value: unknown) {
    const handle = optimistic.update(row.id, key, value, row[key]);
    try {
      await updateRow({ id: row.id, [key]: value }).updates(
        getRows({ offset, limit, sort, filter }),
        getRowCount(filter)
      );
      handle.commit();
    } catch (e) {
      handle.rollback(e instanceof Error ? e.message : 'Update failed');
    }
  }
</script>

<VirtualTable
  columns={columns}
  rows={rows}
  totalCount={totalCount}
  editable
  onUpdate={handleUpdate}
/>
```

### Choosing an optimistic strategy

Two modes are available, switchable at runtime:

**Mode 1: Custom optimistic layer (recommended for virtual tables)**

```ts
import { createOptimisticState } from '$lib/components/custom/virtual-table';

const optimistic = createOptimisticState<Row>();
let rows = $derived(optimistic.applyTo(serverRows));

async function handleUpdate(row, key, value) {
  const handle = optimistic.update(row.id, key, value, row[key]);
  try {
    await updateRow({ id: row.id, [key]: value }).updates(getRows(queryArgs), getRowCount(filter));
    handle.commit();
  } catch (e) {
    handle.rollback(e.message);
    // row reverts instantly, failed() tracks it for retry UI
  }
}
```

Optimistic changes persist across scroll (offset/limit changes), re-sort, and re-filter. Supports per-field pending/failed tracking and retry.

**Mode 2: Remote Functions `.withOverride()` (simpler, for non-virtual tables)**

```ts
import { createPassthroughState } from '$lib/components/custom/virtual-table';

const optimistic = createPassthroughState<Row>(); // no-op, applyTo returns rows unchanged
let rows = $derived(optimistic.applyTo(serverRows));

async function handleUpdate(row, key, value) {
  const handle = optimistic.update(row.id, key, value, row[key]); // no-op
  try {
    await updateRow({ id: row.id, [key]: value }).updates(
      getRows(queryArgs).withOverride((rows) => rows.map(r => r.id === row.id ? { ...r, [key]: value } : r)),
      getRowCount(filter)
    );
    handle.commit(); // no-op
  } catch (e) {
    handle.rollback(); // no-op — .withOverride() auto-reverts on error
  }
}
```

Simpler code, but optimistic changes are tied to a specific query instance. If query args change mid-flight (e.g., user scrolls), the override is lost and the old value flickers back briefly.

**When to use which:**

| Scenario | Recommended |
|----------|-------------|
| Virtual table (offset/limit changes on scroll) | Custom layer |
| Static table, no pagination changes during edits | `.withOverride()` |
| Need failure tracking, retry UI, pending indicators | Custom layer |
| Minimal code, simple CRUD | `.withOverride()` |

The demo page includes a checkbox to toggle between both modes at runtime.

### Column definitions

```ts
const columns: ColumnDef<User>[] = [
  { key: 'id', header: 'ID', width: 60, sortable: true, editable: false },
  { key: 'name', header: 'Name', sortable: true, editable: true },
  {
    key: 'role',
    header: 'Role',
    type: 'select',
    options: ['Junior', 'Senior', 'Lead'],
    editable: true
  },
  {
    key: 'salary',
    header: 'Salary',
    type: 'number',
    render: (v) => `$${Number(v).toLocaleString()}`
  }
];
```

### Column types

| Property | Type | Description |
|----------|------|-------------|
| `key` | `keyof T & string` | Row field to display |
| `header` | `string` | Column header text |
| `width` | `number \| string` | Fixed width (px or CSS value), omit for flex |
| `sortable` | `boolean` | Enable click-to-sort on header |
| `editable` | `boolean` | Enable double-click inline editing |
| `type` | `'text' \| 'number' \| 'select' \| 'date'` | Input type when editing |
| `options` | `string[]` | Options for select type |
| `render` | `(value, row) => string` | Custom display formatter |

### VirtualTable props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `ColumnDef<T>[]` | required | Column definitions |
| `rows` | `T[]` | required | Current page of row data |
| `totalCount` | `number` | required | Total rows in dataset (for scroll height) |
| `sort` | `SortState` | `null` | Current sort state |
| `height` | `string` | `'600px'` | Container height |
| `font` | `string` | `'14px Inter'` | Font for pretext height prediction |
| `editable` | `boolean` | `false` | Enable inline editing |
| `onSort` | `(sort: SortState) => void` | - | Sort change callback |
| `onRangeChange` | `(offset, limit) => void` | - | Visible range change (for fetching) |
| `onUpdate` | `(row, key, value) => void` | - | Cell edit commit callback |
| `onDelete` | `(row) => void` | - | Row delete callback |

## Modules

### `createOptimisticState<T>(idKey?)`

Manages optimistic updates independent of query lifecycle.

```ts
const state = createOptimisticState<Row>();  // uses 'id' by default
const state = createOptimisticState<Row>('uuid');  // custom id field
```

**Methods:**

| Method | Description |
|--------|-------------|
| `applyTo(rows)` | Returns rows with pending updates applied and pending deletes filtered out |
| `update(rowId, key, newValue, oldValue)` | Returns `{ commit(), rollback(error?) }` |
| `remove(rowId, row)` | Returns `{ commit(), rollback(error?) }` |
| `isPending(rowId, key?)` | Check if row/field has a pending operation |
| `isFailed(rowId, key?)` | Check if row/field has a failed operation |
| `pending()` | All pending operations |
| `failed()` | All failed operations |
| `clearFailed()` | Remove all failed operations |
| `retry(operationId)` | Retry a failed operation, returns new handle |

### `createHeightManager({ font, defaultHeight? })`

Wraps `@chenglou/pretext` for row height prediction without DOM measurement.

- `prepareRow(index, cells)` — call `prepare()` per cell, cache results
- `getRowHeight(index, maxWidth?)` — call `layout()` for cached cells, return max height
- `onResize(newMaxWidth)` — invalidate height cache (sub-ms re-layout via pretext)
- `clearRow(index)` / `clear()` — evict cache entries

### `createVirtualScroller(opts)`

Pure arithmetic visible range calculation.

- Input: row count, row height function, container height, scroll top, overscan
- Output: `{ start, end, offsetY, totalHeight }`
- No DOM dependency — fully testable

## Testing

```bash
npx vitest run
```

107 tests covering:
- **virtual-scroller** (14): empty state, uniform/variable heights, overscan clamping, offsetY, 100k row performance
- **demo-db** (18): pagination, filtering, sorting, CRUD operations
- **editable-cell** (17): display, edit mode entry, commit/cancel, type handling
- **optimistic** (48): updates, deletes, rollback, retry, concurrent ops, custom id keys, edge cases
- **passthrough** (10): no-op behavior, reference identity, all methods are safe no-ops
