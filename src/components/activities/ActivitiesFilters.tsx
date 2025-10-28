"use client"

import Link from 'next/link'
import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ACTIVITY_TYPE_OPTIONS, type ActivityType } from '@/lib/activities/types'
import { ChevronDownIcon } from 'lucide-react'

export type ActivitiesFiltersInitial = {
  type?: ActivityType | ''
  location_id?: string | ''
  from?: string | ''
  to?: string | ''
}

export type ActivitiesFilterLocation = { id: string; name: string | null }

export function ActivitiesFilters({
  locations,
  initial,
}: {
  locations: ActivitiesFilterLocation[]
  initial: ActivitiesFiltersInitial
}) {
  const [type, setType] = useState<ActivitiesFiltersInitial['type']>(initial.type ?? '')
  const [locationId, setLocationId] = useState<ActivitiesFiltersInitial['location_id']>(initial.location_id ?? '')
  const [fromDate, setFromDate] = useState<Date | undefined>(parseDateString(initial.from))
  const [toDate, setToDate] = useState<Date | undefined>(parseDateString(initial.to))

  return (
    <form method="get" className="mb-6 grid gap-4 md:grid-cols-5">
      <div className="space-y-1">
        <Label className="text-sm">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v === '__all__' ? '' : (v as ActivityType))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            {ACTIVITY_TYPE_OPTIONS.slice().sort((a, b) => a.label.localeCompare(b.label)).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="type" value={type || ''} />
      </div>

      <div className="space-y-1">
        <Label className="text-sm">Location</Label>
        <Select value={locationId} onValueChange={(v) => setLocationId(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name || 'Untitled'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="location_id" value={locationId || ''} />
      </div>

      <div className="space-y-1">
        <Label className="text-sm">From</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between font-normal">
              {fromDate ? formatDateValue(fromDate) : 'Select date'}
              <ChevronDownIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent sideOffset={8} align="start" className="w-auto overflow-hidden p-0">
            <Calendar mode="single" captionLayout="dropdown" selected={fromDate} onSelect={setFromDate} />
          </PopoverContent>
        </Popover>
        <input type="hidden" name="from" value={formatDateValue(fromDate)} />
      </div>

      <div className="space-y-1">
        <Label className="text-sm">To</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between font-normal">
              {toDate ? formatDateValue(toDate) : 'Select date'}
              <ChevronDownIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent sideOffset={8} align="start" className="w-auto overflow-hidden p-0">
            <Calendar mode="single" captionLayout="dropdown" selected={toDate} onSelect={setToDate} />
          </PopoverContent>
        </Popover>
        <input type="hidden" name="to" value={formatDateValue(toDate)} />
      </div>

      <div className="space-y-1">
        <Label className="text-sm" aria-hidden="true">&nbsp;</Label>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button variant="outline" asChild>
            <Link href="/activities">Reset</Link>
          </Button>
        </div>
      </div>
    </form>
  )
}

function parseDateString(value?: string | null) {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function formatDateValue(value?: Date) {
  if (!value) return ''
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
