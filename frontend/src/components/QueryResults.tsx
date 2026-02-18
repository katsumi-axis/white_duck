import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  getSortedRowModel,
} from '@tanstack/react-table';
import type { QueryResult } from '../lib/api';

interface QueryResultsProps {
  result: QueryResult;
}

export default function QueryResults({ result }: QueryResultsProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // Transform data for react-table
  const data = useMemo(() => {
    return result.data.map((row, index) => {
      const obj: Record<string, unknown> = { __rowIndex: index + 1 };
      result.columns.forEach((col, colIndex) => {
        obj[col.name] = row[colIndex];
      });
      return obj;
    });
  }, [result]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    return result.columns.map((col) => ({
      accessorKey: col.name,
      header: col.name,
      cell: (info) => {
        const value = info.getValue();
        if (value === null) return <span className="text-gray-500 italic">NULL</span>;
        if (value === undefined) return <span className="text-gray-600">-</span>;
        if (typeof value === 'boolean') {
          return (
            <span className={value ? 'text-green-400' : 'text-red-400'}>
              {value.toString()}
            </span>
          );
        }
        if (typeof value === 'number') {
          return <span className="text-blue-300 font-mono">{String(value)}</span>;
        }
        if (typeof value === 'bigint') {
          return <span className="text-blue-300 font-mono">{value.toString()}n</span>;
        }
        // Truncate long strings
        const str = String(value);
        if (str.length > 200) {
          return (
            <span title={str} className="cursor-help">
              {str.slice(0, 200)}...
            </span>
          );
        }
        return str;
      },
    }));
  }, [result.columns]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (result.data.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">
        <div className="text-lg mb-2">Query returned no results</div>
        <div className="text-sm text-gray-500">The query executed successfully but returned 0 rows.</div>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="min-w-full">
        <thead className="bg-gray-800 sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-800 border-b border-gray-700">
                #
              </th>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap bg-gray-800 border-b border-gray-700 cursor-pointer hover:bg-gray-700"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-2">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    <span className="text-gray-500">
                      {{
                        asc: '↑',
                        desc: '↓',
                      }[header.column.getIsSorted() as string] ?? '↕'}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-800">
          {table.getRowModel().rows.map((row, index) => (
            <tr
              key={row.id}
              className={`hover:bg-gray-800/50 ${index % 2 === 0 ? 'bg-gray-900/50' : 'bg-gray-900'}`}
            >
              <td className="px-3 py-1.5 text-xs text-gray-500 font-mono">
                {row.original.__rowIndex as number}
              </td>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="px-3 py-1.5 text-sm text-gray-300 whitespace-nowrap max-w-md truncate"
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
