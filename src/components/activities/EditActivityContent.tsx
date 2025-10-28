"use client"

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ACTIVITY_TYPE_OPTIONS, type ActivityType } from '@/lib/activities/types'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDownIcon } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export type EditActivityContentProps = {
  activity: {
    activity_type: ActivityType
    started_at: string
    ended_at: string | null
    duration_minutes: number | null
    labor_hours: number | null
    location_id: string | null
    crop: string | null
    asset_name: string | null
    asset_id: string | null
    quantity: number | null
    unit: string | null
    cost: number | null
    notes: string | null
  }
  locations: Array<{ id: string; name: string }>
}

export function EditActivityContent({ activity, locations }: EditActivityContentProps) {
  const [type, setType] = useState<ActivityType>(activity.activity_type)
  const [locationId, setLocationId] = useState<string>(activity.location_id || '')
  const [startDate, setStartDate] = useState<Date | undefined>(parseDateString(activity.started_at?.slice(0,10)))
  const [startTime, setStartTime] = useState<string>(activity.started_at?.slice(11,16) || '')
  const [endDate, setEndDate] = useState<Date | undefined>(activity.ended_at ? parseDateString(activity.ended_at.slice(0,10)) : undefined)
  const [endTime, setEndTime] = useState<string>(activity.ended_at?.slice(11,16) || '')

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Hidden inputs to keep server action payload unchanged */}
      <input type="hidden" name="activity_type" value={type} />
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="started_at" value={combineDateTime(startDate, startTime)} />
      <input type="hidden" name="ended_at" value={combineDateTime(endDate, endTime)} />

      <div className="space-y-2">
        <Label className="text-sm">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPE_OPTIONS.slice().sort((a, b) => a.label.localeCompare(b.label)).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Location</Label>
        <Select value={locationId} onValueChange={(v) => setLocationId(v === '__none__' ? '' : v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select location (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator className="col-span-full" />

      <div className="space-y-2">
        <Label className="text-sm">Start</Label>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-32 justify-between font-normal">
                {startDate ? formatDate(startDate) : 'Select date'}
                <ChevronDownIcon className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
              <Calendar mode="single" selected={startDate} captionLayout="dropdown" onSelect={(d) => { setStartDate(d); }} />
            </PopoverContent>
          </Popover>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.currentTarget.value)}
            required
            step="1"
            className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none w-28"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">End</Label>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-32 justify-between font-normal">
                {endDate ? formatDate(endDate) : 'Select date'}
                <ChevronDownIcon className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
              <Calendar mode="single" selected={endDate} captionLayout="dropdown" onSelect={(d) => { setEndDate(d); }} />
            </PopoverContent>
          </Popover>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.currentTarget.value)}
            step="1"
            className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none w-28"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Duration (minutes)</Label>
        <Input type="number" name="duration_minutes" defaultValue={activity.duration_minutes ?? ''} min={0} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Labor Hours</Label>
        <Input type="number" step="0.1" name="labor_hours" defaultValue={activity.labor_hours ?? ''} min={0} />
      </div>

      <Separator className="col-span-full" />

      <div className="space-y-2">
        <Label className="text-sm">Crop</Label>
        <Input type="text" name="crop" defaultValue={activity.crop ?? ''} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Cost</Label>
        <Input type="number" step="0.01" name="cost" defaultValue={activity.cost ?? ''} min={0} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Asset ID</Label>
        <Input type="text" name="asset_id" defaultValue={activity.asset_id ?? ''} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Asset Name</Label>
        <Input type="text" name="asset_name" defaultValue={activity.asset_name ?? ''} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Quantity</Label>
        <Input type="number" step="0.01" name="quantity" defaultValue={activity.quantity ?? ''} min={0} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Unit</Label>
        <Input type="text" name="unit" defaultValue={activity.unit ?? ''} />
      </div>

      <Separator className="col-span-full" />

      <div className="col-span-full space-y-2">
        <Label className="text-sm">Notes</Label>
        <Textarea name="notes" defaultValue={activity.notes ?? ''} />
      </div>
      <div className="col-span-full">
        <Button type="submit">Save</Button>
      </div>
    </div>
  )
}

function parseDateString(value?: string | null) {
  if (!value) return undefined
  // Expecting YYYY-MM-DD
  const [y, m, d] = value.split('-').map((s) => Number(s))
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function formatDate(d?: Date) {
  if (!d) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function combineDateTime(date?: Date, time?: string) {
  if (!date) return ''
  const dateStr = formatDate(date)
  const timeStr = (time && time.length >= 4) ? time : '00:00'
  return `${dateStr}T${timeStr}`
}

