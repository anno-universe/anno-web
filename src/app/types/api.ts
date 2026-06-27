export interface ApiError {
  status: number;
  message: string;
  detail?: string;
  fields?: Record<string, string>;
}

export interface PaginatedResponse<T> {
  count: number;
  limit: number;
  offset: number;
  items: T[];
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}
