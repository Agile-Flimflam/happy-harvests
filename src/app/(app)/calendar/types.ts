export type CalendarEvent = {
  id: string
  type: 'activity' | 'planting' | 'harvest'
  title: string
  start: string
  end?: string | null
  meta?: Record<string, unknown>
}

export type CalendarFilter = 'all' | 'activity' | 'planting' | 'harvest'

export type CalendarLocation = { id: string; name: string; latitude: number | null; longitude: number | null }


