import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  try {
    const body = await req.json().catch(() => ({})) as { bed_id?: number; name?: string }
    const bedId = Number(body?.bed_id)
    const name = String(body?.name || '').trim()
    if (!Number.isFinite(bedId) || !name) {
      return NextResponse.json({ error: 'Invalid bed_id or name' }, { status: 400 })
    }
    const { error } = await supabase.from('beds').update({ name }).eq('id', bedId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}


