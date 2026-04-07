import * as v from 'valibot';
import { query, command, form, requested } from '$app/server';
import { getUsers, getUserCount, updateUser, deleteUser, createUser } from '$lib/server/demo-db';

const querySchema = v.object({
	offset: v.number(),
	limit: v.number(),
	sort: v.nullable(
		v.object({
			key: v.string(),
			direction: v.picklist(['asc', 'desc'])
		})
	),
	filter: v.string()
});

export const getRows = query(querySchema, async ({ offset, limit, sort, filter }) => {
	return getUsers(offset, limit, sort, filter);
});

export const getRowCount = query(v.string(), async (filter) => {
	return getUserCount(filter);
});

const updateSchema = v.object({
	id: v.string(),
	name: v.optional(v.string()),
	email: v.optional(v.string()),
	role: v.optional(v.string()),
	department: v.optional(v.string()),
	salary: v.optional(v.number())
});

export const updateRow = command(updateSchema, async ({ id, ...data }) => {
	const result = updateUser(id, data);
	await requested(getRows, 5).refreshAll();
	await requested(getRowCount, 1).refreshAll();
	return result;
});

export const deleteRow = command(v.string(), async (id) => {
	deleteUser(id);
	await requested(getRows, 5).refreshAll();
	await requested(getRowCount, 1).refreshAll();
});

const createSchema = v.object({
	name: v.pipe(v.string(), v.nonEmpty()),
	email: v.pipe(v.string(), v.nonEmpty()),
	role: v.pipe(v.string(), v.nonEmpty()),
	department: v.pipe(v.string(), v.nonEmpty()),
	salary: v.number()
});

export const createRow = form(createSchema, async (data) => {
	const user = createUser(data);
	await requested(getRows, 5).refreshAll();
	await requested(getRowCount, 1).refreshAll();
	return { success: true, id: user.id };
});
