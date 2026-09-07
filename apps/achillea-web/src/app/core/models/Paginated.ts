export interface Paginated<T> {
	data: T[];
	meta: {
		page: number;
		limit: number;
		total: number;
		pageCount: number;
	};
}
