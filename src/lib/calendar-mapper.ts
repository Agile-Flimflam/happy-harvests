import 'server-only';

import { createSupabaseAdminClient } from './supabase-admin';
import type { Tables } from './supabase-server';

export async function buildPlantingEvent(plantingId: number, siteUrl: string) {
  const supabase = createSupabaseAdminClient();
  // Fetch planting details with joins we need for title/description/timezone
  const { data, error } = await supabase
    .from('plantings')
    .select(`
      id,
      planted_date,
      nursery_started_date,
      notes,
      status,
      beds:bed_id (
        id,
        plots:plot_id (
          name,
          locations:location_id (
            name,
            timezone
          )
        )
      ),
      crop_varieties:crop_variety_id (
        name
      )
    `)
    .eq('id', plantingId)
    .maybeSingle();
  if (error) throw new Error(`DB error loading planting ${plantingId}: ${error.message}`);
  if (!data) throw new Error(`Planting ${plantingId} not found`);

  const planting = data as unknown as Tables<'plantings'> & {
    beds: { id: number; plots: { name: string; locations: { name: string | null; timezone: string | null } | null } | null } | null;
    crop_varieties: { name: string } | null;
  };

  const tz = planting.beds?.plots?.locations?.timezone || undefined;
  const date = planting.planted_date;
  if (!date) throw new Error(`Planting ${plantingId} has no planted_date`);
  const endDate = addOneDay(date);
  const varietyName = planting.crop_varieties?.name || 'Planting';
  const plotName = planting.beds?.plots?.name || '';
  const locationName = planting.beds?.plots?.locations?.name || '';
  const summary = `Planted — ${varietyName}`;
  const descriptionLines = [
    `Method: ${planting.nursery_started_date ? 'Transplant' : 'Direct Seed'}`,
    plotName ? `Plot: ${plotName}` : '',
    planting.notes ? `Notes: ${planting.notes}` : '',
    `View: ${siteUrl.replace(/\/$/, '')}/plantings/${planting.id}`,
  ].filter(Boolean);
  const description = descriptionLines.join('\n');
  const location = [locationName, plotName].filter(Boolean).join(' — ');

  const body = {
    id: buildDeterministicEventId(planting.id),
    summary,
    description,
    location: location || undefined,
    start: { date, timeZone: tz },
    end: { date: endDate, timeZone: tz },
    extendedProperties: { private: { plantingId: String(planting.id) } },
    source: { title: 'Happy Harvests', url: `${siteUrl.replace(/\/$/, '')}/plantings/${planting.id}` },
  };

  return body;
}

export function buildDeterministicEventId(plantingId: number) {
  // Use allowed base32hex chars a-v and digits 0-9; ensure min length 5 and uniqueness per calendar
  // Format: planting{decimalId} (decimal digits are allowed by spec)
  return `planting${plantingId}`;
}

function addOneDay(dateStr: string): string {
  const dt = new Date(dateStr + 'T00:00:00.000Z');
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}


