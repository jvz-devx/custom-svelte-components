import { describe, it, expect } from 'vitest';
import { createOptimisticState, createPassthroughState } from './optimistic.svelte.js';

type Row = { id: string; name: string; email: string; salary: number };

function makeRows(n: number): Row[] {
	return Array.from({ length: n }, (_, i) => ({
		id: String(i + 1),
		name: `User ${i + 1}`,
		email: `user${i + 1}@test.com`,
		salary: 50000 + i * 1000
	}));
}

describe('createOptimisticState', () => {
	describe('applyTo — updates', () => {
		it('applies a pending update optimistically', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(3);
			state.update('1', 'name', 'Updated Name', 'User 1');

			const result = state.applyTo(rows);
			expect(result[0].name).toBe('Updated Name');
			expect(result[1].name).toBe('User 2'); // untouched
			expect(result[2].name).toBe('User 3'); // untouched
		});

		it('applies multiple updates to different fields on the same row', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(2);
			state.update('1', 'name', 'New Name', 'User 1');
			state.update('1', 'salary', 99999, 50000);

			const result = state.applyTo(rows);
			expect(result[0].name).toBe('New Name');
			expect(result[0].salary).toBe(99999);
		});

		it('applies updates to different rows independently', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(3);
			state.update('1', 'name', 'A', 'User 1');
			state.update('3', 'name', 'C', 'User 3');

			const result = state.applyTo(rows);
			expect(result[0].name).toBe('A');
			expect(result[1].name).toBe('User 2');
			expect(result[2].name).toBe('C');
		});

		it('does not mutate the original rows array', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(2);
			const originalName = rows[0].name;
			state.update('1', 'name', 'Changed', originalName);

			state.applyTo(rows);
			expect(rows[0].name).toBe(originalName);
		});

		it('does not apply failed updates', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(2);
			const handle = state.update('1', 'name', 'Failed Change', 'User 1');
			handle.rollback('Server error');

			const result = state.applyTo(rows);
			expect(result[0].name).toBe('User 1'); // rolled back
		});

		it('does not apply committed (removed) updates', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(2);
			const handle = state.update('1', 'name', 'Committed', 'User 1');
			handle.commit();

			// After commit, the overlay is cleared — server data takes over
			const result = state.applyTo(rows);
			expect(result[0].name).toBe('User 1'); // server hasn't changed yet in this test
		});
	});

	describe('applyTo — deletes', () => {
		it('hides a pending-deleted row', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(3);
			state.remove('2', rows[1]);

			const result = state.applyTo(rows);
			expect(result).toHaveLength(2);
			expect(result.map((r) => r.id)).toEqual(['1', '3']);
		});

		it('restores row after delete rollback', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(3);
			const handle = state.remove('2', rows[1]);
			handle.rollback('Delete failed');

			const result = state.applyTo(rows);
			expect(result).toHaveLength(3); // row is back
		});

		it('row stays gone after delete commit', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(3);
			const handle = state.remove('2', rows[1]);
			handle.commit();

			// Commit clears the overlay; the actual filtering is done server-side
			// So applyTo should return all rows since the delete entry is gone
			const result = state.applyTo(rows);
			expect(result).toHaveLength(3); // overlay cleared, server data unchanged in test
		});

		it('can delete multiple rows simultaneously', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(5);
			state.remove('1', rows[0]);
			state.remove('3', rows[2]);
			state.remove('5', rows[4]);

			const result = state.applyTo(rows);
			expect(result).toHaveLength(2);
			expect(result.map((r) => r.id)).toEqual(['2', '4']);
		});
	});

	describe('update + delete interactions', () => {
		it('delete takes precedence over update on same row', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(3);
			state.update('2', 'name', 'Will Be Deleted', 'User 2');
			state.remove('2', rows[1]);

			const result = state.applyTo(rows);
			expect(result).toHaveLength(2);
			expect(result.find((r) => r.id === '2')).toBeUndefined();
		});
	});

	describe('rollback behavior', () => {
		it('rollback sets status to failed with error message', () => {
			const state = createOptimisticState<Row>();
			const handle = state.update('1', 'name', 'X', 'Y');
			handle.rollback('Network error');

			const failedOps = state.failed();
			expect(failedOps).toHaveLength(1);
			expect(failedOps[0].status).toBe('failed');
			expect(failedOps[0].error).toBe('Network error');
		});

		it('rollback uses default error if none provided', () => {
			const state = createOptimisticState<Row>();
			const handle = state.update('1', 'name', 'X', 'Y');
			handle.rollback();

			expect(state.failed()[0].error).toBe('Update failed');
		});

		it('delete rollback uses default error', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(1);
			const handle = state.remove('1', rows[0]);
			handle.rollback();

			expect(state.failed()[0].error).toBe('Delete failed');
		});
	});

	describe('pending() and failed()', () => {
		it('pending returns only pending operations', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(3);
			state.update('1', 'name', 'A', 'B');
			const h2 = state.update('2', 'name', 'C', 'D');
			h2.rollback('err');
			const h3 = state.remove('3', rows[2]);
			h3.commit();

			const pending = state.pending();
			expect(pending).toHaveLength(1);
			expect((pending[0] as any).rowId).toBe('1');
		});

		it('failed returns only failed operations', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(2);
			const h1 = state.update('1', 'name', 'A', 'B');
			h1.rollback('err1');
			const h2 = state.remove('2', rows[1]);
			h2.rollback('err2');
			state.update('1', 'salary', 100, 200); // still pending

			const failedOps = state.failed();
			expect(failedOps).toHaveLength(2);
		});
	});

	describe('clearFailed()', () => {
		it('removes all failed operations', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(2);
			const h1 = state.update('1', 'name', 'X', 'Y');
			h1.rollback('err');
			const h2 = state.remove('2', rows[1]);
			h2.rollback('err');
			state.update('1', 'salary', 100, 50); // pending, not failed

			state.clearFailed();
			expect(state.failed()).toHaveLength(0);
			expect(state.pending()).toHaveLength(1); // pending one survives
		});
	});

	describe('retry()', () => {
		it('retries a failed update, creating a new pending operation', () => {
			const state = createOptimisticState<Row>();
			const h = state.update('1', 'name', 'Retry Me', 'Old');
			h.rollback('err');

			expect(state.failed()).toHaveLength(1);
			const retryHandle = state.retry(h.id);
			expect(retryHandle).not.toBeNull();
			expect(state.failed()).toHaveLength(0);
			expect(state.pending()).toHaveLength(1);

			// The retry creates a new pending update with same data
			const rows = makeRows(2);
			const result = state.applyTo(rows);
			expect(result[0].name).toBe('Retry Me');
		});

		it('retries a failed delete', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(3);
			const h = state.remove('2', rows[1]);
			h.rollback('err');

			const retryHandle = state.retry(h.id);
			expect(retryHandle).not.toBeNull();

			const result = state.applyTo(rows);
			expect(result).toHaveLength(2); // row 2 hidden again
		});

		it('returns null for non-existent operation id', () => {
			const state = createOptimisticState<Row>();
			expect(state.retry('nonexistent')).toBeNull();
		});

		it('returns null for a pending (non-failed) operation', () => {
			const state = createOptimisticState<Row>();
			const h = state.update('1', 'name', 'X', 'Y');
			// h is still pending, not failed
			expect(state.retry(h.id)).toBeNull();
		});

		it('retry handle can itself be committed or rolled back', () => {
			const state = createOptimisticState<Row>();
			const h = state.update('1', 'name', 'Retry', 'Old');
			h.rollback('err');

			const retryHandle = state.retry(h.id)!;
			retryHandle.commit();

			expect(state.pending()).toHaveLength(0);
			expect(state.failed()).toHaveLength(0);
		});
	});

	describe('isPending()', () => {
		it('returns true for row with pending update', () => {
			const state = createOptimisticState<Row>();
			state.update('1', 'name', 'X', 'Y');
			expect(state.isPending('1')).toBe(true);
			expect(state.isPending('1', 'name')).toBe(true);
			expect(state.isPending('1', 'email')).toBe(false);
		});

		it('returns true for row with pending delete', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(1);
			state.remove('1', rows[0]);
			expect(state.isPending('1')).toBe(true);
		});

		it('returns false for row with no operations', () => {
			const state = createOptimisticState<Row>();
			expect(state.isPending('1')).toBe(false);
		});

		it('returns false for committed operation', () => {
			const state = createOptimisticState<Row>();
			const h = state.update('1', 'name', 'X', 'Y');
			h.commit();
			expect(state.isPending('1')).toBe(false);
		});

		it('returns false for failed operation', () => {
			const state = createOptimisticState<Row>();
			const h = state.update('1', 'name', 'X', 'Y');
			h.rollback('err');
			expect(state.isPending('1')).toBe(false);
		});
	});

	describe('isFailed()', () => {
		it('returns true for row with failed update', () => {
			const state = createOptimisticState<Row>();
			const h = state.update('1', 'name', 'X', 'Y');
			h.rollback('err');
			expect(state.isFailed('1')).toBe(true);
			expect(state.isFailed('1', 'name')).toBe(true);
			expect(state.isFailed('1', 'email')).toBe(false);
		});

		it('returns true for row with failed delete', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(1);
			const h = state.remove('1', rows[0]);
			h.rollback('err');
			expect(state.isFailed('1')).toBe(true);
		});

		it('returns false for pending operation', () => {
			const state = createOptimisticState<Row>();
			state.update('1', 'name', 'X', 'Y');
			expect(state.isFailed('1')).toBe(false);
		});
	});

	describe('concurrent operations', () => {
		it('handles rapid successive updates to same field', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(1);

			const h1 = state.update('1', 'name', 'First', 'User 1');
			const h2 = state.update('1', 'name', 'Second', 'User 1');
			const h3 = state.update('1', 'name', 'Third', 'User 1');

			// Last write wins in the overlay
			const result = state.applyTo(rows);
			expect(result[0].name).toBe('Third');

			// Commit first two, third still pending
			h1.commit();
			h2.commit();
			const result2 = state.applyTo(rows);
			expect(result2[0].name).toBe('Third');

			// Commit third
			h3.commit();
			const result3 = state.applyTo(rows);
			expect(result3[0].name).toBe('User 1'); // all committed, back to server data
		});

		it('handles update then delete on same row', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(2);

			state.update('1', 'name', 'About to be deleted', 'User 1');
			state.remove('1', rows[0]);

			// Delete wins — row is hidden
			const result = state.applyTo(rows);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('2');
		});

		it('handles partial rollback in concurrent updates', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(1);

			const h1 = state.update('1', 'name', 'Name Change', 'User 1');
			const h2 = state.update('1', 'salary', 99999, 50000);

			// Name update fails, salary succeeds
			h1.rollback('Name validation error');
			h2.commit();

			const result = state.applyTo(rows);
			expect(result[0].name).toBe('User 1'); // rolled back
			expect(result[0].salary).toBe(50000); // committed, overlay cleared
		});
	});

	describe('custom id key', () => {
		type CustomRow = { uuid: string; label: string };

		it('works with a custom id field', () => {
			const state = createOptimisticState<CustomRow>('uuid');
			const rows: CustomRow[] = [
				{ uuid: 'abc', label: 'First' },
				{ uuid: 'def', label: 'Second' }
			];

			state.update('abc', 'label', 'Updated', 'First');
			const result = state.applyTo(rows);
			expect(result[0].label).toBe('Updated');
		});

		it('delete works with custom id field', () => {
			const state = createOptimisticState<CustomRow>('uuid');
			const rows: CustomRow[] = [
				{ uuid: 'abc', label: 'First' },
				{ uuid: 'def', label: 'Second' }
			];

			state.remove('def', rows[1]);
			const result = state.applyTo(rows);
			expect(result).toHaveLength(1);
			expect(result[0].uuid).toBe('abc');
		});
	});

	describe('edge cases', () => {
		it('applyTo on empty rows returns empty', () => {
			const state = createOptimisticState<Row>();
			state.update('1', 'name', 'X', 'Y');
			expect(state.applyTo([])).toEqual([]);
		});

		it('handles update to row not in current rows slice', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(3);
			// Update row id=99 which isn't in the current page
			state.update('99', 'name', 'Ghost', 'Old');

			const result = state.applyTo(rows);
			expect(result).toHaveLength(3);
			// No crash, no change to visible rows
			expect(result[0].name).toBe('User 1');
		});

		it('handles delete of row not in current rows slice', () => {
			const state = createOptimisticState<Row>();
			const rows = makeRows(3);
			state.remove('99', { id: '99', name: 'Ghost', email: '', salary: 0 });

			const result = state.applyTo(rows);
			expect(result).toHaveLength(3); // nothing removed
		});
	});
});

describe('createPassthroughState', () => {
	it('applyTo returns rows unchanged', () => {
		const state = createPassthroughState<Row>();
		const rows = makeRows(5);
		const result = state.applyTo(rows);
		expect(result).toBe(rows); // same reference, not a copy
	});

	it('update returns a noop handle', () => {
		const state = createPassthroughState<Row>();
		const handle = state.update('1', 'name', 'New', 'Old');
		expect(handle.id).toBe('noop');
		// These should not throw
		handle.commit();
		handle.rollback('err');
	});

	it('remove returns a noop handle', () => {
		const state = createPassthroughState<Row>();
		const rows = makeRows(1);
		const handle = state.remove('1', rows[0]);
		expect(handle.id).toBe('noop');
		handle.commit();
		handle.rollback();
	});

	it('pending is always empty', () => {
		const state = createPassthroughState<Row>();
		state.update('1', 'name', 'X', 'Y');
		expect(state.pending()).toEqual([]);
	});

	it('failed is always empty', () => {
		const state = createPassthroughState<Row>();
		const h = state.update('1', 'name', 'X', 'Y');
		h.rollback('err');
		expect(state.failed()).toEqual([]);
	});

	it('isPending is always false', () => {
		const state = createPassthroughState<Row>();
		state.update('1', 'name', 'X', 'Y');
		expect(state.isPending('1')).toBe(false);
	});

	it('isFailed is always false', () => {
		const state = createPassthroughState<Row>();
		expect(state.isFailed('1')).toBe(false);
	});

	it('retry always returns null', () => {
		const state = createPassthroughState<Row>();
		expect(state.retry('anything')).toBeNull();
	});

	it('clearFailed does not throw', () => {
		const state = createPassthroughState<Row>();
		expect(() => state.clearFailed()).not.toThrow();
	});

	it('does not apply updates even after calling update', () => {
		const state = createPassthroughState<Row>();
		const rows = makeRows(3);
		state.update('1', 'name', 'Changed', 'User 1');
		state.remove('2', rows[1]);

		const result = state.applyTo(rows);
		expect(result).toHaveLength(3);
		expect(result[0].name).toBe('User 1');
	});
});
