import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WeatherBadge } from '@/components/weather/WeatherBadge';
import { DeleteActivityDialog } from '@/components/activities/DeleteActivityDialog';
import { deleteActivity } from '@/app/(app)/activities/_actions';
import type { Tables } from '@/lib/database.types';

type ActivityRow = Tables<'activities'> & { locations?: { name?: string | null } | null };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function parseWeather(a: { weather?: unknown } | null | undefined) {
  let icon: string | null = null;
  let tempF: number | null = null;
  let description: string | null = null;
  const w = a && isRecord(a) ? a.weather : undefined;
  const wrec = isRecord(w) ? w : undefined;
  const current = wrec && isRecord(wrec.current) ? wrec.current : undefined;
  const temp = current?.temp;
  if (typeof temp === 'number') tempF = temp;
  const weather = current && isRecord(current.weather) ? current.weather : undefined;
  const iconMaybe = weather?.icon;
  if (typeof iconMaybe === 'string') icon = iconMaybe;
  const descMaybe = weather?.description;
  if (typeof descMaybe === 'string') description = descMaybe;
  return { icon, tempF, description };
}

interface ActivityListItemProps {
  activity: ActivityRow;
  showTypeBadge?: boolean;
}

export function ActivityListItem({ activity: a, showTypeBadge = false }: ActivityListItemProps) {
  return (
    <li className="py-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showTypeBadge ? (
              <Badge variant="secondary" className="capitalize">
                {String(a.activity_type).replace('_', ' ')}
              </Badge>
            ) : null}
            <span className="font-medium">{a.started_at?.slice(0, 16).replace('T', ' ')}</span>
            {!showTypeBadge && a.labor_hours ? (
              <Badge variant="secondary">{a.labor_hours}h</Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <WeatherBadge {...parseWeather(a)} size="sm" inlineDescription />
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {a.locations?.name ? <span>Location: {a.locations.name}</span> : null}
            {a.crop ? <span>Crop: {a.crop}</span> : null}
            {a.asset_name ? <span>Asset: {a.asset_name}</span> : null}
            {showTypeBadge && a.labor_hours ? <span>Hours: {a.labor_hours}</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/activities/${a.id}/edit`}>Edit</Link>
            </Button>
            <form id={`delete-activity-${a.id}`} action={deleteActivity} className="hidden">
              <input type="hidden" name="id" value={a.id} />
            </form>
            <DeleteActivityDialog formId={`delete-activity-${a.id}`} />
          </div>
        </div>
        {a.notes ? <div className="text-xs text-muted-foreground mt-1">{a.notes}</div> : null}
      </div>
    </li>
  );
}
