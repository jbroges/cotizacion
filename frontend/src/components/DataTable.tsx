import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, rows, rowKey, emptyMessage = "No se encontraron registros." }: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => <th className={`px-5 py-3.5 font-semibold ${column.className ?? ""}`} key={column.key}>{column.header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={columns.length}>{emptyMessage}</td></tr>
            ) : rows.map((row) => (
              <tr className="transition-colors hover:bg-slate-50/70" key={rowKey(row)}>
                {columns.map((column) => <td className={`px-5 py-4 text-slate-700 ${column.className ?? ""}`} key={column.key}>{column.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
