<script lang="ts">
	import {
		VirtualTable,
		createOptimisticState,
		createPassthroughState
	} from '$lib/components/custom/virtual-table/index.js';
	import type { ColumnDef, SortState } from '$lib/components/custom/virtual-table/types.js';
	import { getRows, getRowCount, updateRow, deleteRow, createRow } from './data.remote';
	import type { User } from '$lib/server/demo-db';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	// --- Column config ---
	const allColumns: ColumnDef<User>[] = [
		{ key: 'id', header: 'ID', width: 70, sortable: true, editable: false },
		{ key: 'name', header: 'Name', sortable: true, editable: true },
		{ key: 'email', header: 'Email', sortable: true, editable: true },
		{
			key: 'role',
			header: 'Role',
			width: 130,
			sortable: true,
			editable: true,
			type: 'select',
			options: ['Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'VP']
		},
		{
			key: 'department',
			header: 'Department',
			width: 150,
			sortable: true,
			editable: true,
			type: 'select',
			options: ['Engineering', 'Marketing', 'Sales', 'Design', 'Support', 'Finance', 'HR']
		},
		{
			key: 'salary',
			header: 'Salary',
			width: 120,
			sortable: true,
			editable: true,
			type: 'number',
			render: (v) => `$${Number(v).toLocaleString()}`
		}
	];

	// --- Config state ---
	let useCustomOptimistic = $state(true);
	let editable = $state(true);
	let showDeleteColumn = $state(true);
	let tableHeight = $state(500);
	let overscanAmount = $state(10);
	let showAddForm = $state(true);
	let configOpen = $state(false);
	let columnVisibility = $state<Record<string, boolean>>({
		id: true,
		name: true,
		email: true,
		role: true,
		department: true,
		salary: true
	});

	let visibleColumns = $derived(allColumns.filter((c) => columnVisibility[c.key]));

	// --- Table state ---
	let sort = $state<SortState>(null);
	let filter = $state('');
	let offset = $state(0);
	let limit = $state(100);

	// --- Data fetching ---
	const rowsQuery = $derived(getRows({ offset, limit, sort, filter }));
	const countQuery = $derived(getRowCount(filter));

	let serverRows = $state<User[]>([]);
	let totalCount = $state(0);

	const customState = createOptimisticState<User>();
	const passthroughState = createPassthroughState<User>();
	let optimistic = $derived(useCustomOptimistic ? customState : passthroughState);

	let rows = $derived(optimistic.applyTo(serverRows));
	let pendingCount = $derived(optimistic.pending().length);
	let failedCount = $derived(optimistic.failed().length);

	$effect(() => {
		rowsQuery.then((data) => (serverRows = data));
	});
	$effect(() => {
		countQuery.then((count) => (totalCount = count));
	});

	// --- Handlers ---
	function handleRangeChange(newOffset: number, newLimit: number) {
		const bufferedLimit = newLimit + 50;
		if (newOffset !== offset || bufferedLimit !== limit) {
			offset = newOffset;
			limit = bufferedLimit;
		}
	}

	async function handleUpdate(row: User, key: string, value: unknown) {
		const handle = optimistic.update(row.id, key, value, row[key as keyof User]);
		try {
			const queryArgs = { offset, limit, sort, filter };
			if (useCustomOptimistic) {
				await updateRow({ id: row.id, [key]: value }).updates(
					getRows(queryArgs),
					getRowCount(filter)
				);
			} else {
				await updateRow({ id: row.id, [key]: value }).updates(
					getRows(queryArgs).withOverride((rows: User[]) =>
						rows.map((r) => (r.id === row.id ? { ...r, [key]: value } : r))
					),
					getRowCount(filter)
				);
			}
			handle.commit();
		} catch (e) {
			handle.rollback(e instanceof Error ? e.message : 'Update failed');
		}
	}

	async function handleDelete(row: User) {
		const handle = optimistic.remove(row.id, row);
		try {
			const queryArgs = { offset, limit, sort, filter };
			if (useCustomOptimistic) {
				await deleteRow(row.id).updates(getRows(queryArgs), getRowCount(filter));
			} else {
				await deleteRow(row.id).updates(
					getRows(queryArgs).withOverride((rows: User[]) =>
						rows.filter((r) => r.id !== row.id)
					),
					getRowCount(filter).withOverride((count: number) => count - 1)
				);
			}
			handle.commit();
		} catch (e) {
			handle.rollback(e instanceof Error ? e.message : 'Delete failed');
		}
	}
</script>

<div class="p-6">
	<!-- Header + Toolbar -->
	<div class="mb-4 flex flex-wrap items-center gap-3">
		<div class="mr-auto">
			<h1 class="text-2xl font-bold tracking-tight">Virtual Table</h1>
			<p class="text-sm text-muted-foreground">
				Pretext height prediction, optimistic CRUD, Remote Functions.
			</p>
		</div>

		<Input placeholder="Search rows..." bind:value={filter} class="w-56" />

		<Button
			variant="outline"
			size="sm"
			onclick={() => (configOpen = !configOpen)}
		>
			<SettingsIcon class="mr-1 size-4" />
			Config
			<ChevronDownIcon
				class="ml-1 size-3 transition-transform {configOpen ? 'rotate-180' : ''}"
			/>
		</Button>

		<Badge variant="secondary">{totalCount.toLocaleString()} rows</Badge>

		{#if sort}
			<Badge variant="outline">{sort.key} {sort.direction === 'asc' ? '↑' : '↓'}</Badge>
			<Button variant="ghost" size="sm" onclick={() => (sort = null)}>Clear sort</Button>
		{/if}
		{#if useCustomOptimistic && pendingCount > 0}
			<Badge variant="default">{pendingCount} pending</Badge>
		{/if}
		{#if useCustomOptimistic && failedCount > 0}
			<Badge variant="destructive">{failedCount} failed</Badge>
			<Button variant="ghost" size="sm" onclick={() => optimistic.clearFailed()}>Dismiss</Button>
		{/if}
	</div>

	<!-- Collapsible Config -->
	{#if configOpen}
		<Card.Root class="mb-4">
			<Card.Content class="grid gap-6 pt-4 sm:grid-cols-2 lg:grid-cols-4">
				<!-- Optimistic Strategy -->
				<div>
					<p class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Optimistic Strategy
					</p>
					<div class="space-y-1.5">
						<label class="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="optimistic"
								checked={useCustomOptimistic}
								onchange={() => (useCustomOptimistic = true)}
								class="accent-primary"
							/>
							Custom layer
						</label>
						<label class="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="optimistic"
								checked={!useCustomOptimistic}
								onchange={() => (useCustomOptimistic = false)}
								class="accent-primary"
							/>
							.withOverride()
						</label>
					</div>
				</div>

				<!-- Editing -->
				<div>
					<p class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Editing
					</p>
					<div class="space-y-1.5">
						<label class="flex items-center gap-2 text-sm">
							<Checkbox bind:checked={editable} />
							Inline editing
						</label>
						<label class="flex items-center gap-2 text-sm">
							<Checkbox bind:checked={showDeleteColumn} />
							Delete column
						</label>
						<label class="flex items-center gap-2 text-sm">
							<Checkbox bind:checked={showAddForm} />
							Add row form
						</label>
					</div>
				</div>

				<!-- Columns -->
				<div>
					<p class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Columns
					</p>
					<div class="grid grid-cols-2 gap-1.5">
						{#each allColumns as col}
							<label class="flex items-center gap-2 text-sm">
								<Checkbox bind:checked={columnVisibility[col.key]} />
								{col.header}
							</label>
						{/each}
					</div>
				</div>

				<!-- Sliders -->
				<div class="space-y-3">
					<div>
						<p class="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Table Height
						</p>
						<div class="flex items-center gap-2">
							<input
								type="range"
								min="200"
								max="800"
								step="50"
								bind:value={tableHeight}
								class="flex-1"
							/>
							<span class="w-12 text-right text-xs text-muted-foreground">{tableHeight}px</span>
						</div>
					</div>
					<div>
						<p class="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Overscan
						</p>
						<div class="flex items-center gap-2">
							<input
								type="range"
								min="0"
								max="50"
								step="5"
								bind:value={overscanAmount}
								class="flex-1"
							/>
							<span class="w-12 text-right text-xs text-muted-foreground">{overscanAmount}</span>
						</div>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Add Form -->
	{#if showAddForm}
		<Card.Root class="mb-4">
			<Card.Content class="pt-4">
				<form {...createRow} class="flex flex-wrap items-end gap-2">
					<div class="space-y-1">
						<label for="new-name" class="text-xs text-muted-foreground">Name</label>
						<Input
							id="new-name"
							{...createRow.fields.name.as('text')}
							placeholder="Full name"
							class="h-8 w-40"
						/>
					</div>
					<div class="space-y-1">
						<label for="new-email" class="text-xs text-muted-foreground">Email</label>
						<Input
							id="new-email"
							{...createRow.fields.email.as('text')}
							placeholder="Email"
							class="h-8 w-48"
						/>
					</div>
					<div class="space-y-1">
						<label for="new-role" class="text-xs text-muted-foreground">Role</label>
						<select
							id="new-role"
							{...createRow.fields.role.as('select')}
							class="h-8 rounded-md border bg-background px-2 text-sm"
						>
							<option value="">Select...</option>
							{#each ['Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'VP'] as role}
								<option value={role}>{role}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-1">
						<label for="new-dept" class="text-xs text-muted-foreground">Department</label>
						<select
							id="new-dept"
							{...createRow.fields.department.as('select')}
							class="h-8 rounded-md border bg-background px-2 text-sm"
						>
							<option value="">Select...</option>
							{#each ['Engineering', 'Marketing', 'Sales', 'Design', 'Support', 'Finance', 'HR'] as dept}
								<option value={dept}>{dept}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-1">
						<label for="new-salary" class="text-xs text-muted-foreground">Salary</label>
						<Input
							id="new-salary"
							{...createRow.fields.salary.as('number')}
							placeholder="50000"
							class="h-8 w-28"
						/>
					</div>
					<Button type="submit" size="sm">Add Row</Button>
				</form>
				{#each createRow.fields.allIssues() as issue}
					<p class="mt-2 text-xs text-destructive">{issue.message}</p>
				{/each}
				{#if createRow.result?.success}
					<p class="mt-2 text-xs text-green-600">Row added successfully.</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Table -->
	<VirtualTable
		columns={visibleColumns}
		{rows}
		{totalCount}
		{sort}
		{editable}
		height="{tableHeight}px"
		onSort={(s) => (sort = s)}
		onRangeChange={handleRangeChange}
		onUpdate={handleUpdate}
		onDelete={showDeleteColumn ? handleDelete : undefined}
	/>

	<!-- Footer -->
	<div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
		<span>
			Rows {offset + 1}–{Math.min(offset + limit, totalCount)} of {totalCount.toLocaleString()}
		</span>
		<span>
			{useCustomOptimistic ? 'Custom optimistic' : '.withOverride()'}
			&middot; Overscan: {overscanAmount}
			&middot; Double-click to edit
		</span>
	</div>
</div>
