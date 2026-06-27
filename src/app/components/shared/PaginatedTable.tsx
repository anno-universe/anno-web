import { LoadingSpinner } from "./LoadingSpinner";

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

export interface PaginationState {
  count: number;
  limit: number;
  offset: number;
}

interface PaginatedTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  pagination: PaginationState;
  onPageChange: (offset: number, limit: number) => void;
  isLoading?: boolean;
  getRowKey: (row: T) => string | number;
}

const PAGE_SIZES = [10, 20, 50, 100];

export function PaginatedTable<T>({
  columns,
  rows,
  pagination,
  onPageChange,
  isLoading = false,
  getRowKey,
}: PaginatedTableProps<T>) {
  const { count, limit, offset } = pagination;
  const totalPages = Math.ceil(count / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const start = count === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, count);

  function goToPage(page: number) {
    const newOffset = (page - 1) * limit;
    onPageChange(newOffset, limit);
  }

  function changePageSize(newLimit: number) {
    onPageChange(0, newLimit);
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="relative">
            {isLoading && rows.length > 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-2">
                  <div className="absolute inset-0 flex items-center justify-center bg-card/60">
                    <LoadingSpinner />
                  </div>
                </td>
              </tr>
            )}
            {rows.length === 0 && !isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No items to display.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  className="border-b last:border-b-0 transition-colors hover:bg-muted/30"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-sm ${col.className ?? ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {count === 0
              ? "No results"
              : `Showing ${start}–${end} of ${count}`}
          </span>
          <label className="flex items-center gap-1">
            <span>Rows:</span>
            <select
              value={limit}
              onChange={(e) => changePageSize(Number(e.target.value))}
              className="rounded border bg-background px-1.5 py-0.5 text-xs"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="rounded border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-2 text-xs text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="rounded border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
