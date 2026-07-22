import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SettingsTableColumn {
  key: string;
  header?: ReactNode;
  className?: string;
}

interface SettingsTableProps {
  columns: readonly SettingsTableColumn[];
  children: ReactNode;
  emptyMessage?: ReactNode;
  tableClassName?: string;
}

export function SettingsTable({
  columns,
  children,
  emptyMessage,
  tableClassName,
}: SettingsTableProps) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-md border">
      <Table className={tableClassName}>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {children}
          {emptyMessage !== undefined && (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
