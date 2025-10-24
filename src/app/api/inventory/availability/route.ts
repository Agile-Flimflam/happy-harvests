import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isWeightUnit, toGrams } from '@/lib/units'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const idsCsv = url.searchParams.get('ids') || ''
  const ids = idsCsv.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
  if (!ids.length) return NextResponse.json({ availability: [] })

  const supabase = await createSupabaseServerClient()
  const { data: plantings, error: pErr } = await supabase
    .from('plantings')
    .select('id,crop_variety_id')
    .in('crop_variety_id', ids)
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  const plantingIdToVariety = new Map<number, number>()
  for (const p of plantings || []) {
    if (typeof p.id === 'number' && typeof p.crop_variety_id === 'number') {
      plantingIdToVariety.set(p.id, p.crop_variety_id)
    }
  }
  const plantingIds = Array.from(plantingIdToVariety.keys())

  const harvestedCount = new Map<number, number>()
  const harvestedGrams = new Map<number, number>()
  if (plantingIds.length) {
    const { data: peRows, error: peErr } = await supabase
      .from('planting_events')
      .select('planting_id, qty, weight_grams, event_type')
      .eq('event_type', 'harvested')
      .in('planting_id', plantingIds)
    if (peErr) return NextResponse.json({ error: peErr.message }, { status: 500 })
    for (const e of peRows || []) {
      const vId = e.planting_id != null ? plantingIdToVariety.get(e.planting_id) : undefined
      if (typeof vId === 'number') {
        const q = typeof e.qty === 'number' ? e.qty : 0
        const g = typeof e.weight_grams === 'number' ? e.weight_grams : 0
        harvestedCount.set(vId, (harvestedCount.get(vId) || 0) + q)
        harvestedGrams.set(vId, (harvestedGrams.get(vId) || 0) + g)
      }
    }
  }

  const deliveredCount = new Map<number, number>()
  const deliveredGrams = new Map<number, number>()
  {
    const { data: diRows, error: diErr } = await supabase
      .from('delivery_items')
      .select('crop_variety_id, qty, unit')
      .in('crop_variety_id', ids)
    if (diErr) return NextResponse.json({ error: diErr.message }, { status: 500 })
    for (const r of diRows || []) {
      const vId = r.crop_variety_id
      if (typeof vId === 'number' && typeof r.qty === 'number') {
        if (isWeightUnit(r.unit)) {
          deliveredGrams.set(vId, (deliveredGrams.get(vId) || 0) + toGrams(r.qty, r.unit))
        } else {
          deliveredCount.set(vId, (deliveredCount.get(vId) || 0) + r.qty)
        }
      }
    }
  }

  const availability = ids.map((vId) => ({
    crop_variety_id: vId,
    count_available: (harvestedCount.get(vId) || 0) - (deliveredCount.get(vId) || 0),
    grams_available: (harvestedGrams.get(vId) || 0) - (deliveredGrams.get(vId) || 0),
  }))

  return NextResponse.json({ availability })
}


