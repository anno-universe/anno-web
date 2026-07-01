import { LoadingSpinner } from "./LoadingSpinner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn("px-4 text-xs text-muted-foreground", col.className)}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="relative">
          {isLoading && rows.length > 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="px-4 py-2">
                <div className="absolute inset-0 flex items-center justify-center bg-card/60">
                  <LoadingSpinner />
                </div>
              </TableCell>
            </TableRow>
          )}
          {rows.length === 0 && !isLoading ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="px-4 py-12 text-center text-sm text-muted-foreground"
              >
                No items to display.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={getRowKey(row)} className="hover:bg-muted/30">
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn("px-4 py-3 text-sm", col.className)}
                  >
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination controls */}
      <Separator />
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {count === 0
              ? "No results"
              : `Showing ${start}–${end} of ${count}`}
          </span>
          <label className="flex items-center gap-1.5">
            <span>Rows:</span>
            <Select
              value={String(limit)}
              onValueChange={(v) => changePageSize(Number(v))}
            >
              <SelectTrigger size="sm" className="h-7">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          <span className="px-2 text-xs text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
