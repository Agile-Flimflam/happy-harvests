import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Tables } from '@/lib/database.types'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const location_id = searchParams.get('location_id')

  let query = supabase.from('activities').select('*').order('started_at', { ascending: true })
  if (type) query = query.eq('activity_type', type as 'irrigation' | 'soil_amendment' | 'pest_management' | 'asset_maintenance')
  if (from) query = query.gte('started_at', from)
  if (to) query = query.lte('started_at', to)
  if (location_id) query = query.eq('location_id', location_id)
  const { data, error } = await query
  if (error) {
    return new NextResponse(error.message, { status: 500 })
  }

  const headers = [
    'id','activity_type','started_at','ended_at','duration_minutes','labor_hours','location_id','crop','asset_id','asset_name','quantity','unit','cost','notes'
  ]
  const rows = (data || []).map((r) => headers.map((h) => {
    const v = (r as Tables<'activities'>)[h as keyof Tables<'activities'>]
    if (v == null) return ''
    return String(v).replaceAll('"', '""')
  }).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="activities.csv"',
      'Cache-Control': 'no-store',
    },
  })
}


