export type User = {
	id: string;
	name: string;
	email: string;
	role: string;
	department: string;
	salary: number;
};

const departments = ['Engineering', 'Marketing', 'Sales', 'Design', 'Support', 'Finance', 'HR'];
const roles = ['Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'VP'];
const firstNames = [
	'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank',
	'Iris', 'Jack', 'Karen', 'Leo', 'Mia', 'Noah', 'Olivia', 'Paul',
	'Quinn', 'Rose', 'Sam', 'Tara', 'Uma', 'Vic', 'Wendy', 'Xander', 'Yara', 'Zane'
];
const lastNames = [
	'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
	'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
	'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
];

function seededRandom(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) & 0x7fffffff;
		return s / 0x7fffffff;
	};
}

const rand = seededRandom(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

const users: User[] = Array.from({ length: 10_000 }, (_, i) => ({
	id: String(i + 1),
	name: `${pick(firstNames)} ${pick(lastNames)}`,
	email: `user${i + 1}@example.com`,
	role: pick(roles),
	department: pick(departments),
	salary: Math.round((40_000 + rand() * 160_000) / 1000) * 1000
}));

export function getUsers(
	offset: number,
	limit: number,
	sort: { key: string; direction: 'asc' | 'desc' } | null,
	filter: string
): User[] {
	let result = users;

	if (filter) {
		const lower = filter.toLowerCase();
		result = result.filter(
			(u) =>
				u.name.toLowerCase().includes(lower) ||
				u.email.toLowerCase().includes(lower) ||
				u.role.toLowerCase().includes(lower) ||
				u.department.toLowerCase().includes(lower)
		);
	}

	if (sort) {
		const dir = sort.direction === 'asc' ? 1 : -1;
		const key = sort.key as keyof User;
		result = [...result].sort((a, b) => {
			const av = a[key];
			const bv = b[key];
			if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
			return String(av).localeCompare(String(bv)) * dir;
		});
	}

	return result.slice(offset, offset + limit);
}

export function getUserCount(filter: string): number {
	if (!filter) return users.length;
	const lower = filter.toLowerCase();
	return users.filter(
		(u) =>
			u.name.toLowerCase().includes(lower) ||
			u.email.toLowerCase().includes(lower) ||
			u.role.toLowerCase().includes(lower) ||
			u.department.toLowerCase().includes(lower)
	).length;
}

export function updateUser(id: string, data: Partial<Omit<User, 'id'>>): User {
	const idx = users.findIndex((u) => u.id === id);
	if (idx === -1) throw new Error('User not found');
	users[idx] = { ...users[idx], ...data };
	return users[idx];
}

export function deleteUser(id: string): void {
	const idx = users.findIndex((u) => u.id === id);
	if (idx === -1) throw new Error('User not found');
	users.splice(idx, 1);
}

export function createUser(data: Omit<User, 'id'>): User {
	const id = String(Math.max(...users.map((u) => Number(u.id))) + 1);
	const user = { id, ...data };
	users.unshift(user);
	return user;
}
