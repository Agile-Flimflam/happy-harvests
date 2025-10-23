'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { hawaiianMoonForISO } from '@/lib/hawaiian-moon'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActivityFormState } from '@/app/(app)/activities/_actions'
function AmendmentsEditor() {
  const [items, setItems] = React.useState<Array<{ name: string; quantity?: string; unit?: string; notes?: string }>>([
    { name: '' },
  ])
  React.useEffect(() => {
    const payload = JSON.stringify(
      items.filter((i) => i.name && i.name.trim().length > 0).map((i) => ({
        name: i.name,
        quantity: i.quantity ? Number(i.quantity) : null,
        unit: i.unit || null,
        notes: i.notes || null,
      }))
    )
    const el = document.getElementById('amendments_json') as HTMLInputElement | null
    if (el) el.value = payload
  }, [items])
  function addRow() {
    setItems((prev) => [...prev, { name: '' }])
  }
  function updateRow(idx: number, field: keyof (typeof items)[number], value: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }
  return (
    <div className="col-span-full space-y-3">
      <input type="hidden" id="amendments_json" name="amendments_json" />
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Soil Amendments</label>
        <Button type="button" size="sm" variant="outline" onClick={addRow}>Add Amendment</Button>
      </div>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2">
            <input className="col-span-4 border rounded px-2 py-1" placeholder="Name (e.g., Base Fertilizer)" value={it.name} onChange={(e) => updateRow(idx, 'name', e.currentTarget.value)} />
            <input className="col-span-2 border rounded px-2 py-1" placeholder="Qty" type="number" step="0.01" value={it.quantity || ''} onChange={(e) => updateRow(idx, 'quantity', e.currentTarget.value)} />
            <input className="col-span-2 border rounded px-2 py-1" placeholder="Unit (kg, lb)" value={it.unit || ''} onChange={(e) => updateRow(idx, 'unit', e.currentTarget.value)} />
            <input className="col-span-3 border rounded px-2 py-1" placeholder="Notes" value={it.notes || ''} onChange={(e) => updateRow(idx, 'notes', e.currentTarget.value)} />
            <Button type="button" size="sm" variant="destructive" onClick={() => removeRow(idx)}>Remove</Button>
          </div>
        ))}
      </div>
    </div>
  )
}

type ActivityFormProps = {
  action: (prevState: ActivityFormState, formData: FormData) => Promise<ActivityFormState>
  locations: Array<{ id: string; name: string }>
  plots?: Array<{ plot_id: number; name: string; location_id: string }>
  beds?: Array<{ id: number; plot_id: number; name?: string | null }>
  nurseries?: Array<{ id: string; name: string; location_id: string }>
  defaultStart?: string | null
}

export function ActivityForm({ action, locations, plots = [], beds = [], nurseries = [], defaultStart = null }: ActivityFormProps) {
  const initialState: ActivityFormState = { message: '', errors: {} }
  const [state, formAction] = useActionState(action, initialState)
  const [activityType, setActivityType] = React.useState<string>('')
  const [locationId, setLocationId] = React.useState<string>('')
  const [startValue, setStartValue] = React.useState<string>(defaultStart || '')
  const [endValue, setEndValue] = React.useState<string>('')
  const [autoDuration, setAutoDuration] = React.useState<boolean>(true)
  const [duration, setDuration] = React.useState<string>('')
  const [plotId, setPlotId] = React.useState<string>('')
  const [bedId, setBedId] = React.useState<string>('')
  const [nurseryId, setNurseryId] = React.useState<string>('')
  type TemplatePayload = {
    activity_type?: string
    location_id?: string
    plot_id?: string
    bed_id?: string
    nursery_id?: string
    duration_minutes?: string | number
  }
  const [templates, setTemplates] = React.useState<Array<{ name: string; payload: TemplatePayload }>>([])

  function formatNowLocal() {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const yyyy = d.getFullYear()
    const mm = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const mi = pad(d.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  }

  function formatLocalFromDate(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const yyyy = d.getFullYear()
    const mm = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const mi = pad(d.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  }

  function setEndFromStartDelta(mins: number) {
    const base = startValue ? new Date(startValue) : new Date()
    if (isNaN(base.getTime())) return
    const end = new Date(base.getTime() + mins * 60000)
    setEndValue(formatLocalFromDate(end))
  }

  React.useEffect(() => {
    if (!autoDuration) return
    if (!startValue || !endValue) return
    const sd = new Date(startValue)
    const ed = new Date(endValue)
    if (isNaN(sd.getTime()) || isNaN(ed.getTime())) return
    const minutes = Math.max(0, Math.round((ed.getTime() - sd.getTime()) / 60000))
    setDuration(String(minutes))
  }, [startValue, endValue, autoDuration])

  // Auto-select single available location
  React.useEffect(() => {
    if (!locationId && locations.length === 1) {
      setLocationId(locations[0].id)
    }
  }, [locations, locationId])

  // Type-based duration presets
  function getPresetsForType(t: string) {
    switch (t) {
      case 'irrigation':
        return [15, 30, 45, 60]
      case 'soil_amendment':
        return [15, 30, 60]
      case 'pest_management':
        return [15, 30]
      case 'asset_maintenance':
        return [30, 60, 90, 120]
      default:
        return [15, 30, 60]
    }
  }

  // Templates (localStorage)
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('hh_activity_templates')
      if (raw) setTemplates(JSON.parse(raw))
    } catch {}
  }, [])
  function saveTemplate() {
    const name = prompt('Template name?')?.trim()
    if (!name) return
    const payload = {
      activity_type: activityType,
      location_id: locationId,
      plot_id: plotId,
      bed_id: bedId,
      nursery_id: nurseryId,
      duration_minutes: duration,
    }
    const next = [...templates.filter((t) => t.name !== name), { name, payload }]
    setTemplates(next)
    try { localStorage.setItem('hh_activity_templates', JSON.stringify(next)) } catch {}
  }
  function loadTemplate(name: string) {
    const t = templates.find((x) => x.name === name)
    if (!t) return
    const p = t.payload || {}
    if (p.activity_type) setActivityType(p.activity_type)
    if (p.location_id) setLocationId(p.location_id)
    if (p.plot_id) setPlotId(String(p.plot_id))
    if (p.bed_id) setBedId(String(p.bed_id))
    if (p.nursery_id) setNurseryId(String(p.nursery_id))
    if (p.duration_minutes) setDuration(String(p.duration_minutes))
  }

  // Field visibility based on selected type
  const visibility = React.useMemo(() => {
    const v = {
      showLocation: false,
      showCrop: false,
      showAsset: false,
      showQuantityUnit: false,
      showCost: false,
      showLaborHours: false,
      showAmendments: false,
    }
    switch (activityType) {
      case 'irrigation':
        v.showLocation = true
        // keep other fields hidden for simplicity
        break
      case 'soil_amendment':
        v.showLocation = true
        v.showCrop = true
        v.showQuantityUnit = true
        v.showCost = true
        v.showAmendments = true
        break
      case 'pest_management':
        v.showLocation = true
        v.showCrop = true
        v.showQuantityUnit = true
        v.showCost = true
        break
      case 'asset_maintenance':
        v.showAsset = true
        v.showCost = true
        v.showLaborHours = true
        break
    }
    return v
  }, [activityType])
  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="activity_type" value={activityType} />
      <input type="hidden" name="location_id" value={locationId} />
      {/* Hidden refs to submit if selected */}
      <input type="hidden" name="plot_id" value={plotId} />
      <input type="hidden" name="bed_id" value={bedId} />
      <input type="hidden" name="nursery_id" value={nurseryId} />
      <div className="col-span-full text-xs font-semibold uppercase text-muted-foreground">Step 1 · What</div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Activity Type</label>
        <Select value={activityType} onValueChange={(v) => { setActivityType(v) }}>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="irrigation">Irrigation</SelectItem>
            <SelectItem value="soil_amendment">Soil Amendment</SelectItem>
            <SelectItem value="pest_management">Pest Management</SelectItem>
            <SelectItem value="asset_maintenance">Asset Maintenance</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {activityType ? (
        <>
          <div className="col-span-full text-xs font-semibold uppercase text-muted-foreground">Step 2 · When</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Start</label>
              <Button type="button" size="sm" variant="outline" onClick={() => setStartValue(formatNowLocal())}>Now</Button>
            </div>
            <Input type="datetime-local" name="started_at" value={startValue} onChange={(e) => setStartValue(e.currentTarget.value)} required />
            {startValue ? (
              <div className="text-xs text-muted-foreground">Hawaiian moon: <span className="font-medium">{hawaiianMoonForISO(startValue) ?? '—'}</span></div>
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">End</label>
              <Button type="button" size="sm" variant="outline" onClick={() => setEndValue(formatNowLocal())}>Now</Button>
            </div>
            <Input type="datetime-local" name="ended_at" value={endValue} onChange={(e) => setEndValue(e.currentTarget.value)} />
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-muted-foreground">Quick set:</span>
              <Button type="button" size="sm" variant="outline" onClick={() => setEndFromStartDelta(15)}>+15m</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEndFromStartDelta(30)}>+30m</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEndFromStartDelta(60)}>+1h</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEndValue('')}>Clear</Button>
            </div>
            {endValue ? (
              <div className="text-xs text-muted-foreground">Hawaiian moon: <span className="font-medium">{hawaiianMoonForISO(endValue) ?? '—'}</span></div>
            ) : null}
          </div>
        </>
      ) : null}

      {visibility.showLocation ? (
        <div className="col-span-full">
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Step 3 · Where</div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 md:col-span-1">
              <label className="text-sm font-medium">Location</label>
              <Select value={locationId} onValueChange={(v) => { setLocationId(v); setPlotId(''); setBedId(''); setNurseryId('') }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-1">
              <label className="text-sm font-medium">Plot</label>
              <select name="plot_id" className="w-full h-9 border rounded px-2" value={plotId} onChange={(e) => { setPlotId(e.currentTarget.value); setBedId('') }} disabled={!locationId}>
                <option value="">—</option>
                {plots.filter((p) => p.location_id === locationId).map((p) => (
                  <option key={p.plot_id} value={p.plot_id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-1">
              <label className="text-sm font-medium">Bed</label>
              <select name="bed_id" className="w-full h-9 border rounded px-2" value={bedId} onChange={(e) => setBedId(e.currentTarget.value)} disabled={!locationId}>
                <option value="">—</option>
                {beds.filter((b) => (plotId ? String(b.plot_id) === plotId : true)).map((b) => (
                  <option key={b.id} value={b.id}>{b.name ? b.name : `Bed #${b.id}`}</option>
                ))}
              </select>
            {bedId ? (
              <div className="flex items-center gap-2 text-xs mt-1">
                <input id="rename_bed_name" placeholder="Rename bed…" className="h-7 border rounded px-2 flex-1" />
                <Button type="button" size="sm" variant="outline" onClick={async () => {
                  const nameEl = document.getElementById('rename_bed_name') as HTMLInputElement | null
                  const name = nameEl?.value.trim() || ''
                  if (!name) return
                  try {
                    const res = await fetch('/api/beds/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bed_id: Number(bedId), name }) })
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}))
                      throw new Error(data?.error || 'Rename failed')
                    }
                    // Optimistic UI: replace label in select option
                    nameEl!.value = ''
                    const idx = beds.findIndex((b) => String(b.id) === String(bedId))
                    if (idx >= 0) beds[idx].name = name
                    toast.success('Bed renamed')
                  } catch {}
                }}>Rename</Button>
              </div>
            ) : null}
            </div>
            <div className="space-y-1 md:col-span-1">
              <label className="text-sm font-medium">Nursery</label>
              <select name="nursery_id" className="w-full h-9 border rounded px-2" value={nurseryId} onChange={(e) => setNurseryId(e.currentTarget.value)} disabled={!locationId}>
                <option value="">—</option>
                {nurseries.filter((n) => n.location_id === locationId).map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}
      {activityType ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Duration (minutes)</label>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-1">
                {getPresetsForType(activityType).map((m) => (
                  <Button key={m} type="button" size="sm" variant="outline" onClick={() => { setDuration(String(m)); setAutoDuration(false); setEndFromStartDelta(m) }}>{`+${m}m`}</Button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={autoDuration} onChange={(e) => setAutoDuration(e.currentTarget.checked)} />
                Auto-calc
              </label>
            </div>
          </div>
          <Input type="number" name="duration_minutes" min={0} value={duration} onChange={(e) => { setDuration(e.currentTarget.value); setAutoDuration(false) }} />
        </div>
      ) : null}
      {visibility.showLaborHours ? (
        <div className="space-y-2">
          <label className="text-sm font-medium">Labor Hours</label>
          <Input type="number" step="0.1" name="labor_hours" min={0} />
        </div>
      ) : null}
      {visibility.showLocation ? (
        <div className="space-y-2">
          <label className="text-sm font-medium">Location</label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger>
              <SelectValue placeholder="Select location (optional)" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {(visibility.showCrop || visibility.showAsset || visibility.showQuantityUnit || visibility.showCost || visibility.showAmendments) ? (
        <div className="col-span-full text-xs font-semibold uppercase text-muted-foreground">Step 4 · Details</div>
      ) : null}
      {visibility.showCrop ? (
        <div className="space-y-2">
          <label className="text-sm font-medium">Crop</label>
          <Input type="text" name="crop" placeholder="e.g., Lettuce" />
        </div>
      ) : null}
      {visibility.showAsset ? (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Asset Name</label>
            <Input type="text" name="asset_name" placeholder="e.g., Ford F-150" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Asset ID</label>
            <Input type="text" name="asset_id" placeholder="e.g., TRK-001" />
          </div>
        </>
      ) : null}
      {visibility.showQuantityUnit ? (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Quantity</label>
            <Input type="number" step="0.01" name="quantity" min={0} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Unit</label>
            <Input type="text" name="unit" placeholder="e.g., L, kg" />
          </div>
        </>
      ) : null}
      {visibility.showCost ? (
        <div className="space-y-2">
          <label className="text-sm font-medium">Cost</label>
          <Input type="number" step="0.01" name="cost" min={0} />
        </div>
      ) : null}

      {visibility.showAmendments ? (
        <AmendmentsEditor />
      ) : null}
      <div className="col-span-full space-y-2">
        <label className="text-sm font-medium">Notes</label>
        <Textarea name="notes" placeholder="Any details…" />
      </div>
      <div className="col-span-full">
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={!activityType}>Save Activity</Button>
          <Button type="button" variant="outline" onClick={saveTemplate} disabled={!activityType}>Save as Template</Button>
          {templates.length ? (
            <select className="border rounded px-2 py-1" onChange={(e) => { if (e.currentTarget.value) loadTemplate(e.currentTarget.value) }} defaultValue="">
              <option value="">Load Template…</option>
              {templates.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          ) : null}
        </div>
      </div>
      {state?.message ? <div className="col-span-full text-sm text-muted-foreground">{state.message}</div> : null}
    </form>
  )
}


