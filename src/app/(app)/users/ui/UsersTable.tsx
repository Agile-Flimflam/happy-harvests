'use client'

import * as React from 'react'
import { useMemo, useState } from 'react'
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table'
import type { ListedUser } from '../_actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import EditUserDialog from './EditUserDialog'
import { updateUserProfileAction } from '../_actions'
import { ChevronsUpDown, Pencil } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type Props = {
  initialUsers: ListedUser[]
}

export default function UsersTable({ initialUsers }: Props) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'user', desc: false }])
  const [users, setUsers] = useState(initialUsers)

  const [editing, setEditing] = useState<ListedUser | null>(null)

  const columns = useMemo<ColumnDef<ListedUser>[]>(() => [
    {
      id: 'user',
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-2 font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          User
          <ChevronsUpDown className="size-4 opacity-50" />
        </button>
      ),
      accessorKey: 'displayName',
      cell: ({ row }) => {
        const u = row.original
        const initials = (u.displayName || u.email || '')
          .split(' ')
          .map((s) => s[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
        return (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="size-8 ring-1 ring-border">
              <AvatarImage src={u.avatarUrl || undefined} alt={u.displayName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium leading-tight truncate">{u.displayName}</div>
              <div className="text-xs text-muted-foreground truncate">{u.email}</div>
            </div>
          </div>
        )
      },
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
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const haystack = `${row.original.email || ''} ${row.original.displayName || ''}`.toLowerCase()
      return haystack.includes(String(filterValue).toLowerCase())
    },
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input placeholder="Search email…" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="max-w-xs" />
      </div>
      <div className="rounded border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/50">
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
