'use client'

import * as React from 'react'
import Link from 'next/link'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'

export type CalendarEvent = {
  id: string
  type: 'activity' | 'planting'
  title: string
  start: string
  end?: string | null
  meta?: Record<string, unknown>
}

type CalendarFilter = 'all' | 'activity' | 'planting'

export default function CalendarClient({ events }: { events: CalendarEvent[] }) {
  const today = new Date()
  const [current, setCurrent] = React.useState<{ y: number; m: number }>({ y: today.getFullYear(), m: today.getMonth() })
  const [filter, setFilter] = React.useState<CalendarFilter>('all')

  function startOfMonth(y: number, m: number) { return new Date(y, m, 1) }

  const first = startOfMonth(current.y, current.m)
  const firstDay = new Date(first)
  firstDay.setDate(first.getDate() - first.getDay())

  const cells: Date[] = []
  for (let i = 0; i < 42; i++) { // 6 weeks
    const d = new Date(firstDay)
    d.setDate(firstDay.getDate() + i)
    cells.push(d)
  }

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter)
  const byDay = new Map<string, CalendarEvent[]>()
  for (const e of filtered) {
    const day = e.start.slice(0,10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(e)
  }

  function fmt(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="border rounded px-2 py-1" onClick={() => setCurrent(({ y, m }) => (m === 0 ? { y: y-1, m: 11 } : { y, m: m-1 }))}>Prev</button>
          <div className="font-semibold">{new Date(current.y, current.m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
          <button className="border rounded px-2 py-1" onClick={() => setCurrent(({ y, m }) => (m === 11 ? { y: y+1, m: 0 } : { y, m: m+1 }))}>Next</button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Filter</label>
          <select className="border rounded px-2 py-1" value={filter} onChange={(e) => { const v = e.currentTarget.value; if (v === 'all' || v === 'activity' || v === 'planting') setFilter(v) }}>
            <option value="all">All</option>
            <option value="activity">Activities</option>
            <option value="planting">Plantings</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="text-xs text-muted-foreground px-1">{d}</div>
        ))}
        {cells.map((d) => {
          const key = fmt(d)
          const dayEvents = byDay.get(key) || []
          const isOtherMonth = d.getMonth() !== current.m
          return (
            <div key={key} className={`min-h-28 border rounded p-1 ${isOtherMonth ? 'bg-muted/30 text-muted-foreground' : ''}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="font-semibold">{d.getDate()}</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="border rounded px-1.5 py-0.5">Add</button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={{ pathname: '/activities/new', searchParams: { start: key + 'T09:00' } }}>Schedule Activity</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={{ pathname: '/plantings', searchParams: { schedule: key, mode: 'nursery' } }}>Nursery sow</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={{ pathname: '/plantings', searchParams: { schedule: key, mode: 'direct' } }}>Direct seed</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <ul className="space-y-1">
                {dayEvents.slice(0,4).map((e) => (
                  <li key={e.id} className={`truncate text-xs ${e.type === 'activity' ? 'text-blue-700' : 'text-green-700'}`} title={e.title}>
                    {e.type === 'activity' ? 'A' : 'P'} · {e.title}
                  </li>
                ))}
                {dayEvents.length > 4 ? (
                  <li className="text-xs text-muted-foreground">+{dayEvents.length - 4} more</li>
                ) : null}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}


