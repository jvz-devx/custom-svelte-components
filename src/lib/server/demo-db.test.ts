import { describe, it, expect, beforeEach } from 'vitest';
import { getUsers, getUserCount, updateUser, deleteUser, createUser, type User } from './demo-db.js';

describe('demo-db', () => {
	describe('getUsers', () => {
		it('returns correct number of rows for offset/limit', () => {
			const rows = getUsers(0, 10, null, '');
			expect(rows).toHaveLength(10);
		});

		it('returns empty array when offset exceeds data', () => {
			const rows = getUsers(999_999, 10, null, '');
			expect(rows).toHaveLength(0);
		});

		it('returns correct slice with offset', () => {
			const first10 = getUsers(0, 10, null, '');
			const second10 = getUsers(10, 10, null, '');
			expect(first10[0].id).not.toBe(second10[0].id);
		});

		it('all returned rows have required fields', () => {
			const rows = getUsers(0, 50, null, '');
			for (const row of rows) {
				expect(row).toHaveProperty('id');
				expect(row).toHaveProperty('name');
				expect(row).toHaveProperty('email');
				expect(row).toHaveProperty('role');
				expect(row).toHaveProperty('department');
				expect(row).toHaveProperty('salary');
				expect(typeof row.salary).toBe('number');
			}
		});
	});

	describe('filtering', () => {
		it('filters by name', () => {
			const rows = getUsers(0, 10000, null, 'alice');
			expect(rows.length).toBeGreaterThan(0);
			for (const row of rows) {
				const matchesAny =
					row.name.toLowerCase().includes('alice') ||
					row.email.toLowerCase().includes('alice') ||
					row.role.toLowerCase().includes('alice') ||
					row.department.toLowerCase().includes('alice');
				expect(matchesAny).toBe(true);
			}
		});

		it('filters by email', () => {
			const rows = getUsers(0, 10, null, 'user1@');
			expect(rows.length).toBeGreaterThan(0);
			expect(rows[0].email).toContain('user1@');
		});

		it('filters by role', () => {
			const rows = getUsers(0, 10000, null, 'senior');
			expect(rows.length).toBeGreaterThan(0);
			for (const row of rows) {
				const matchesAny =
					row.name.toLowerCase().includes('senior') ||
					row.email.toLowerCase().includes('senior') ||
					row.role.toLowerCase().includes('senior') ||
					row.department.toLowerCase().includes('senior');
				expect(matchesAny).toBe(true);
			}
		});

		it('filters by department', () => {
			const rows = getUsers(0, 10000, null, 'engineering');
			expect(rows.length).toBeGreaterThan(0);
		});

		it('returns empty for non-matching filter', () => {
			const rows = getUsers(0, 100, null, 'zzzznonexistent');
			expect(rows).toHaveLength(0);
		});

		it('filter is case-insensitive', () => {
			const lower = getUsers(0, 10000, null, 'engineering');
			const upper = getUsers(0, 10000, null, 'ENGINEERING');
			expect(lower.length).toBe(upper.length);
		});
	});

	describe('sorting', () => {
		it('sorts by name ascending', () => {
			const rows = getUsers(0, 20, { key: 'name', direction: 'asc' }, '');
			for (let i = 1; i < rows.length; i++) {
				expect(rows[i].name.localeCompare(rows[i - 1].name)).toBeGreaterThanOrEqual(0);
			}
		});

		it('sorts by name descending', () => {
			const rows = getUsers(0, 20, { key: 'name', direction: 'desc' }, '');
			for (let i = 1; i < rows.length; i++) {
				expect(rows[i].name.localeCompare(rows[i - 1].name)).toBeLessThanOrEqual(0);
			}
		});

		it('sorts by salary ascending', () => {
			const rows = getUsers(0, 20, { key: 'salary', direction: 'asc' }, '');
			for (let i = 1; i < rows.length; i++) {
				expect(rows[i].salary).toBeGreaterThanOrEqual(rows[i - 1].salary);
			}
		});

		it('sorts by salary descending', () => {
			const rows = getUsers(0, 20, { key: 'salary', direction: 'desc' }, '');
			for (let i = 1; i < rows.length; i++) {
				expect(rows[i].salary).toBeLessThanOrEqual(rows[i - 1].salary);
			}
		});

		it('sorting + filtering work together', () => {
			const rows = getUsers(0, 100, { key: 'salary', direction: 'asc' }, 'engineering');
			expect(rows.length).toBeGreaterThan(0);
			for (let i = 1; i < rows.length; i++) {
				expect(rows[i].salary).toBeGreaterThanOrEqual(rows[i - 1].salary);
			}
		});

		it('sorting + offset/limit work correctly', () => {
			const all = getUsers(0, 100, { key: 'salary', direction: 'asc' }, '');
			const page2 = getUsers(10, 10, { key: 'salary', direction: 'asc' }, '');
			expect(page2).toEqual(all.slice(10, 20));
		});
	});

	describe('getUserCount', () => {
		it('returns 10000 with no filter', () => {
			expect(getUserCount('')).toBe(10000);
		});

		it('returns filtered count', () => {
			const count = getUserCount('engineering');
			const rows = getUsers(0, 100000, null, 'engineering');
			expect(count).toBe(rows.length);
		});

		it('returns 0 for non-matching filter', () => {
			expect(getUserCount('zzzznonexistent')).toBe(0);
		});
	});

	describe('CRUD operations', () => {
		it('updateUser modifies a user', () => {
			const before = getUsers(0, 1, null, '')[0];
			const updated = updateUser(before.id, { name: 'Updated Name' });
			expect(updated.name).toBe('Updated Name');
			expect(updated.id).toBe(before.id);

			// Verify it persists
			const fetched = getUsers(0, 1, null, '')[0];
			expect(fetched.name).toBe('Updated Name');
		});

		it('updateUser throws for nonexistent id', () => {
			expect(() => updateUser('nonexistent', { name: 'X' })).toThrow('User not found');
		});

		it('updateUser only changes specified fields', () => {
			const before = getUsers(0, 1, null, '')[0];
			const originalEmail = before.email;
			updateUser(before.id, { name: 'Partial Update' });
			const after = getUsers(0, 1, null, '')[0];
			expect(after.email).toBe(originalEmail);
		});

		it('createUser adds a user at the beginning', () => {
			const countBefore = getUserCount('');
			const newUser = createUser({
				name: 'New Person',
				email: 'new@example.com',
				role: 'Junior',
				department: 'Engineering',
				salary: 50000
			});
			expect(newUser.id).toBeDefined();
			expect(getUserCount('')).toBe(countBefore + 1);

			// Should be first
			const first = getUsers(0, 1, null, '')[0];
			expect(first.id).toBe(newUser.id);
		});

		it('deleteUser removes a user', () => {
			const countBefore = getUserCount('');
			const first = getUsers(0, 1, null, '')[0];
			deleteUser(first.id);
			expect(getUserCount('')).toBe(countBefore - 1);
		});

		it('deleteUser throws for nonexistent id', () => {
			expect(() => deleteUser('nonexistent')).toThrow('User not found');
		});
	});
});
