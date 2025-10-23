'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { Tables } from '@/lib/database.types'

type Row = Tables<'activities'> & { locations?: { name?: string | null } | null }

type ActivitiesTableProps = {
  rows: Row[]
  bulkDeleteAction: (formData: FormData) => Promise<void>
}

export function ActivitiesTable({ rows, bulkDeleteAction }: ActivitiesTableProps) {
  const [selected, setSelected] = React.useState<Record<number, boolean>>({})

  function toggleAll(checked: boolean) {
    const next: Record<number, boolean> = {}
    if (checked) for (const r of rows) next[r.id] = true
    setSelected(next)
  }
  function toggleOne(id: number, checked: boolean) {
    setSelected((prev) => ({ ...prev, [id]: checked }))
  }
  const idsCsv = Object.entries(selected).filter(([, v]) => v).map(([k]) => k).join(',')
  const [confirmOpen, setConfirmOpen] = React.useState(false)

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
          const form = document.getElementById('bulk-delete-form') as HTMLFormElement | null
          if (form) form.requestSubmit()
          setConfirmOpen(false)
        }}
      />
      <table className="w-full text-sm">
        <thead className="bg-accent/40">
          <tr>
            <th className="p-2"><input type="checkbox" onChange={(e) => toggleAll(e.currentTarget.checked)} /></th>
            <th className="p-2 text-left">Date</th>
            <th className="p-2 text-left">Type</th>
            <th className="p-2 text-left">Location</th>
            <th className="p-2 text-left">Crop</th>
            <th className="p-2 text-left">Asset</th>
            <th className="p-2 text-right">Hours</th>
            <th className="p-2 text-right">Cost</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2"><input type="checkbox" checked={!!selected[r.id]} onChange={(e) => toggleOne(r.id, e.currentTarget.checked)} /></td>
              <td className="p-2">{r.started_at?.slice(0,16).replace('T',' ')}</td>
              <td className="p-2 capitalize">{String(r.activity_type).replace('_',' ')}</td>
              <td className="p-2">{r.locations?.name ?? '—'}</td>
              <td className="p-2">{r.crop ?? '—'}</td>
              <td className="p-2">{r.asset_name ?? '—'}</td>
              <td className="p-2 text-right">{r.labor_hours ?? '—'}</td>
              <td className="p-2 text-right">{r.cost ?? '—'}</td>
              <td className="p-2 text-right">
                <Button asChild size="sm" variant="outline"><Link href={`/activities/${r.id}/edit`}>Edit</Link></Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between p-2">
        <div className="text-xs text-muted-foreground">{Object.values(selected).filter(Boolean).length} selected</div>
        <form id="bulk-delete-form" action={bulkDeleteAction}>
          <input type="hidden" name="ids" value={idsCsv} />
          <Button type="button" size="sm" variant="destructive" disabled={!idsCsv} onClick={() => setConfirmOpen(true)}>Delete Selected</Button>
        </form>
      </div>
    </div>
  )
}


