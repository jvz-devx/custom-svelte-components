/**
 * Manages optimistic updates with automatic rollback on failure.
 *
 * Tracks pending mutations, applies them immediately to a local overlay,
 * and rolls back if the server rejects the change.
 */

type PendingUpdate<T> = {
	id: string;
	rowId: string;
	key: string;
	newValue: unknown;
	oldValue: unknown;
	status: 'pending' | 'committed' | 'failed';
	error?: string;
};

type PendingDelete<T> = {
	id: string;
	rowId: string;
	row: T;
	status: 'pending' | 'committed' | 'failed';
	error?: string;
};

export type OptimisticState<T> = {
	/** Apply all pending updates/deletes to a row array, returning the optimistic view */
	applyTo(rows: T[]): T[];
	/** Start an optimistic update. Returns a handle to commit or rollback. */
	update(rowId: string, key: string, newValue: unknown, oldValue: unknown): OptimisticHandle;
	/** Start an optimistic delete. Returns a handle to commit or rollback. */
	remove(rowId: string, row: T): OptimisticHandle;
	/** Get all pending operations */
	pending(): Array<PendingUpdate<T> | PendingDelete<T>>;
	/** Get failed operations */
	failed(): Array<PendingUpdate<T> | PendingDelete<T>>;
	/** Clear all failed operations */
	clearFailed(): void;
	/** Retry a failed operation (returns the handle for the new attempt) */
	retry(operationId: string): OptimisticHandle | null;
	/** Check if a specific row+key has a pending update */
	isPending(rowId: string, key?: string): boolean;
	/** Check if a specific row+key has failed */
	isFailed(rowId: string, key?: string): boolean;
};

export type OptimisticHandle = {
	id: string;
	commit(): void;
	rollback(error?: string): void;
};

const noopHandle: OptimisticHandle = {
	id: 'noop',
	commit() {},
	rollback() {}
};

/**
 * Creates a passthrough (disabled) optimistic state.
 * `applyTo` returns rows unchanged, all operations are no-ops.
 * Use this when relying on Remote Functions' `.withOverride()` instead.
 */
export function createPassthroughState<T extends Record<string, unknown>>(): OptimisticState<T> {
	return {
		applyTo: (rows) => rows,
		update: () => noopHandle,
		remove: () => noopHandle,
		pending: () => [],
		failed: () => [],
		clearFailed: () => {},
		retry: () => null,
		isPending: () => false,
		isFailed: () => false
	};
}

let nextId = 0;

export function createOptimisticState<T extends Record<string, unknown>>(
	idKey: keyof T & string = 'id' as keyof T & string
): OptimisticState<T> {
	const updates = new Map<string, PendingUpdate<T>>();
	const deletes = new Map<string, PendingDelete<T>>();

	function applyTo(rows: T[]): T[] {
		// Filter out optimistically deleted rows
		let result = rows.filter((row) => {
			const rowId = String(row[idKey]);
			for (const del of deletes.values()) {
				if (del.rowId === rowId && del.status === 'pending') return false;
			}
			return true;
		});

		// Apply optimistic updates
		result = result.map((row) => {
			const rowId = String(row[idKey]);
			let modified = false;
			let updated = { ...row };

			for (const upd of updates.values()) {
				if (upd.rowId === rowId && upd.status === 'pending') {
					(updated as Record<string, unknown>)[upd.key] = upd.newValue;
					modified = true;
				}
			}

			return modified ? updated : row;
		});

		return result;
	}

	function update(rowId: string, key: string, newValue: unknown, oldValue: unknown): OptimisticHandle {
		const id = `upd_${nextId++}`;
		updates.set(id, { id, rowId, key, newValue, oldValue, status: 'pending' });

		return {
			id,
			commit() {
				updates.delete(id);
			},
			rollback(error?: string) {
				const entry = updates.get(id);
				if (entry) {
					entry.status = 'failed';
					entry.error = error ?? 'Update failed';
				}
			}
		};
	}

	function remove(rowId: string, row: T): OptimisticHandle {
		const id = `del_${nextId++}`;
		deletes.set(id, { id, rowId, row, status: 'pending' });

		return {
			id,
			commit() {
				deletes.delete(id);
			},
			rollback(error?: string) {
				const entry = deletes.get(id);
				if (entry) {
					entry.status = 'failed';
					entry.error = error ?? 'Delete failed';
				}
			}
		};
	}

	function allOps(): Array<PendingUpdate<T> | PendingDelete<T>> {
		return [...updates.values(), ...deletes.values()];
	}

	function pending() {
		return allOps().filter((op) => op.status === 'pending');
	}

	function failed() {
		return allOps().filter((op) => op.status === 'failed');
	}

	function clearFailed() {
		for (const [id, upd] of updates) {
			if (upd.status === 'failed') updates.delete(id);
		}
		for (const [id, del] of deletes) {
			if (del.status === 'failed') deletes.delete(id);
		}
	}

	function retry(operationId: string): OptimisticHandle | null {
		const upd = updates.get(operationId);
		if (upd && upd.status === 'failed') {
			updates.delete(operationId);
			return update(upd.rowId, upd.key, upd.newValue, upd.oldValue);
		}
		const del = deletes.get(operationId);
		if (del && del.status === 'failed') {
			deletes.delete(operationId);
			return remove(del.rowId, del.row);
		}
		return null;
	}

	function isPending(rowId: string, key?: string): boolean {
		for (const upd of updates.values()) {
			if (upd.rowId === rowId && upd.status === 'pending') {
				if (!key || upd.key === key) return true;
			}
		}
		for (const del of deletes.values()) {
			if (del.rowId === rowId && del.status === 'pending') return true;
		}
		return false;
	}

	function isFailed(rowId: string, key?: string): boolean {
		for (const upd of updates.values()) {
			if (upd.rowId === rowId && upd.status === 'failed') {
				if (!key || upd.key === key) return true;
			}
		}
		for (const del of deletes.values()) {
			if (del.rowId === rowId && del.status === 'failed') return true;
		}
		return false;
	}

	return {
		applyTo,
		update,
		remove,
		pending,
		failed,
		clearFailed,
		retry,
		isPending,
		isFailed
	};
}
