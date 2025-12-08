'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ColumnDef,
  Column,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ArrowUp, ArrowDown, ArrowUpDown, type LucideIcon } from 'lucide-react';
import type { Tables } from '@/lib/database.types';

type Row = Tables<'activities'> & { locations?: { name?: string | null } | null };

type ActivitiesTableProps = {
  rows: Row[];
  bulkDeleteAction: (
    formData: FormData
  ) => Promise<{ message: string; errors?: Record<string, string[] | undefined> }>;
};

export function ActivitiesTable({ rows, bulkDeleteAction }: ActivitiesTableProps) {
  const [selected, setSelected] = React.useState<Record<number, boolean>>({});
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'started_at', desc: true }]);

  const toggleAll = React.useCallback(
    (checked: boolean) => {
      const next: Record<number, boolean> = {};
      if (checked) for (const r of rows) next[r.id] = true;
      setSelected(next);
    },
    [rows]
  );

  const toggleOne = React.useCallback((id: number, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: checked }));
  }, []);

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input type="checkbox" onChange={(e) => toggleAll(e.currentTarget.checked)} />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={!!selected[row.original.id]}
            onChange={(e) => toggleOne(row.original.id, e.currentTarget.checked)}
          />
        ),
        enableSorting: false,
        size: 36,
      },
      {
        id: 'started_at',
        accessorFn: (r) => r.started_at || '',
        header: ({ column }) => <SortHeader column={column} title="Date" align="left" />,
        cell: ({ getValue }) =>
          String(getValue() || '')
            .slice(0, 16)
            .replace('T', ' '),
        enableSorting: true,
      },
      {
        id: 'activity_type',
        accessorFn: (r) => String(r.activity_type || ''),
        header: () => <span>Type</span>,
        cell: ({ getValue }) => String(getValue() || '').replace('_', ' '),
        enableSorting: false,
      },
      {
        id: 'location_name',
        accessorFn: (r) => r.locations?.name || '—',
        header: () => <span>Location</span>,
        cell: ({ getValue }) => String(getValue()),
        enableSorting: false,
      },
      {
        id: 'crop',
        accessorKey: 'crop',
        header: () => <span>Crop</span>,
        cell: ({ getValue }) => String(getValue() ?? '—'),
        enableSorting: false,
      },
      {
        id: 'asset_name',
        accessorKey: 'asset_name',
        header: () => <span>Asset</span>,
        cell: ({ getValue }) => String(getValue() ?? '—'),
        enableSorting: false,
      },
      {
        id: 'labor_hours',
        accessorFn: (r) => r.labor_hours ?? null,
        header: ({ column }) => <SortHeader column={column} title="Hours" align="right" />,
        cell: ({ getValue }) => (getValue() == null ? '—' : String(getValue())),
        enableSorting: true,
      },
      {
        id: 'cost',
        accessorFn: (r) => r.cost ?? null,
        header: ({ column }) => <SortHeader column={column} title="Cost" align="right" />,
        cell: ({ getValue }) => (getValue() == null ? '—' : String(getValue())),
        enableSorting: true,
      },
      {
        id: 'actions',
        header: () => null,
        cell: ({ row }) => (
          <Button asChild size="sm" variant="outline">
            <Link href={`/activities/${row.original.id}/edit`}>Edit</Link>
          </Button>
        ),
        enableSorting: false,
      },
    ],
    [selected, toggleAll, toggleOne]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // client-side sorting
  });

  // toggleAll/toggleOne are useCallback above
  const idsCsv = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(',');

  const handleBulkDelete = React.useCallback(
    async (formData: FormData) => {
      await bulkDeleteAction(formData);
    },
    [bulkDeleteAction]
  );

  return (
    <div className="border rounded-md overflow-auto">
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete selected activities?"
        description="This action cannot be undone."
        confirmText="Delete"
        confirmVariant="destructive"
        onConfirm={() => {
          const form = document.getElementById('bulk-delete-form') as HTMLFormElement | null;
          if (form) form.requestSubmit();
          setConfirmOpen(false);
        }}
      />
      <table className="w-full text-sm">
        <thead className="bg-accent/40">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className={`p-2 ${h.column.id === 'labor_hours' || h.column.id === 'cost' ? 'text-right' : 'text-left'}`}
                  aria-sort={ariaSort(h.column.getIsSorted())}
                >
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id} className="border-t">
              {r.getVisibleCells().map((c) => (
                <td
                  key={c.id}
                  className={`p-2 ${c.column.id === 'labor_hours' || c.column.id === 'cost' ? 'text-right' : ''}`}
                >
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between p-2">
        <div className="text-xs text-muted-foreground">
          {Object.values(selected).filter(Boolean).length} selected
        </div>
        <form id="bulk-delete-form" action={handleBulkDelete}>
          <input type="hidden" name="ids" value={idsCsv} />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={!idsCsv}
            onClick={() => setConfirmOpen(true)}
          >
            Delete Selected
          </Button>
        </form>
      </div>
    </div>
  );
}

function ariaSort(sorted: false | 'asc' | 'desc'): 'none' | 'ascending' | 'descending' {
  if (sorted === 'asc') return 'ascending';
  if (sorted === 'desc') return 'descending';
  return 'none';
}

function SortHeader<RowData>({
  column,
  title,
  align = 'left',
}: {
  column: Column<RowData, unknown>;
  title: string;
  align?: 'left' | 'right';
}) {
  const sorted = column.getIsSorted() as false | 'asc' | 'desc';
  const Icon: LucideIcon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end w-full' : ''}`}
      onClick={() => column.toggleSorting(sorted === 'asc')}
      aria-label={`Sort by ${title}`}
    >
      <span>{title}</span>
      <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
