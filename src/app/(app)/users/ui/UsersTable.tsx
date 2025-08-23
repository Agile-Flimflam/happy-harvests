'use client'

import * as React from 'react'
import { useMemo, useState } from 'react'
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, useReactTable } from '@tanstack/react-table'
import type { ListedUser } from '../_actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import EditUserDialog from './EditUserDialog'
import { updateUserProfileAction } from '../_actions'
import { Pencil } from 'lucide-react'

type Props = {
  initialUsers: ListedUser[]
}

export default function UsersTable({ initialUsers }: Props) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [users, setUsers] = useState(initialUsers)

  const [editing, setEditing] = useState<ListedUser | null>(null)

  const columns = useMemo<ColumnDef<ListedUser>[]>(() => [
    {
      id: 'displayName',
      header: 'Name',
      accessorKey: 'displayName',
      cell: ({ row }) => <span>{row.original.displayName}</span>,
    },
    {
      id: 'email',
      header: 'Email',
      accessorKey: 'email',
      cell: ({ row }) => <span className="font-medium">{row.original.email}</span>,
    },
    {
      id: 'role',
      header: 'Role',
      accessorKey: 'role',
      cell: ({ row }) => {
        const role = row.original.role
        const variant: 'default' | 'secondary' | 'destructive' | 'outline' = role === 'admin' ? 'secondary' : 'outline'
        return <Badge variant={variant}>{role}</Badge>
      },
    },
    {
      id: 'created',
      header: 'Created',
      accessorKey: 'createdAt',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => setEditing(row.original)}>
          <Pencil className="mr-2" /> Edit
        </Button>
      ),
    },
  ], [])

  const table = useReactTable({
    data: users,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const v = (row.original.email || '').toLowerCase()
      return v.includes(String(filterValue).toLowerCase())
    },
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input placeholder="Search email…" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="max-w-xs" />
      </div>
      <div className="rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="text-left p-2 font-medium">{h.isPlaceholder ? null : h.column.columnDef.header as string}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-2">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <EditUserDialog
        user={editing ? { id: editing.id, email: editing.email, displayName: editing.displayName, role: editing.role, avatarUrl: editing.avatarUrl } : null}
        onClose={() => setEditing(null)}
        onSaveProfile={async (formData) => {
          const userId = String(formData.get('userId'))
          const nextRole = formData.get('role') as 'admin' | 'member'
          const nextDisplayName = String(formData.get('displayName') || '')
          const prev = users
          setUsers((curr) => curr.map((u) => u.id === userId ? { ...u, role: nextRole, displayName: nextDisplayName || u.displayName } : u))
          const res = await updateUserProfileAction(formData)
          if (!res.ok) {
            setUsers(prev)
            toast.error(res.error || 'Failed to update user')
          } else {
            toast.success('User updated')
          }
          return res
        }}
      />
    </div>
  )
}


