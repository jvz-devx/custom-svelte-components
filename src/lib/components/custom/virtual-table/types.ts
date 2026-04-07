export type ColumnDef<T> = {
	key: keyof T & string;
	header: string;
	width?: number | string;
	sortable?: boolean;
	editable?: boolean;
	type?: 'text' | 'number' | 'select' | 'date';
	options?: string[];
	render?: (value: unknown, row: T) => string;
};

export type SortState = {
	key: string;
	direction: 'asc' | 'desc';
} | null;

export type RowsQuery<T> = (args: {
	offset: number;
	limit: number;
	sort: SortState;
	filter: string;
}) => Promise<T[]> & { refresh(): void };

export type CountQuery = (filter: string) => Promise<number> & { refresh(): void };
