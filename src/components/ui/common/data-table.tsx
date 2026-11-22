// src/components/ui/common/data-table.tsx
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { cn } from '@/lib/utils';

/**
 * DataTable — built on TanStack Table v8.
 *
 * `cols` accepts the original lightweight shape ({key,label,style,render}) and is converted
 * to TanStack ColumnDef internally, so existing call sites (`<DataTable cols={...} rows={...} />`)
 * do not need to change.
 */
export interface SimpleColumn<T> {
  key: keyof T | string;
  label: string;
  style?: React.CSSProperties;
  render?: (value: any, row: T) => React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  cols,
  rows,
  onRow,
}: {
  cols: SimpleColumn<T>[];
  rows: T[];
  onRow?: (r: T) => void;
}) {
  const columns: ColumnDef<T, any>[] = cols.map((c, i) => ({
    id: `${String(c.key)}-${i}`,
    accessorKey: c.key as string,
    header: c.label,
    cell: (ctx) => (c.render ? c.render(ctx.getValue(), ctx.row.original) : ctx.getValue()),
    meta: { style: c.style },
  }));

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-gray-100">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  style={(header.column.columnDef.meta as any)?.style}
                  className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider pb-3 px-3 first:pl-0"
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRow?.(row.original)}
              className={cn('border-b border-gray-50 last:border-0', onRow && 'cursor-pointer hover:bg-gray-50')}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={(cell.column.columnDef.meta as any)?.style}
                  className="py-3 px-3 first:pl-0 text-gray-700"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
