import { Sprout, Leaf, ArrowRightLeft, Move, ShoppingBasket, Shovel } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Enums } from '@/lib/supabase-server';
import { formatPlantingEventType, formatPlantingStatus } from '@/lib/labels/plantings';

type PlantingEventType = Enums<'planting_event_type'>;
type PlantingStatus = Enums<'planting_status'>;

export function getEventIcon(eventType: PlantingEventType) {
  switch (eventType) {
    case 'nursery_seeded': return <Sprout className="h-4 w-4 text-green-600" />;
    case 'direct_seeded': return <Leaf className="h-4 w-4 text-green-600" />;
    case 'transplanted': return <ArrowRightLeft className="h-4 w-4 text-blue-600" />;
    case 'moved': return <Move className="h-4 w-4 text-blue-600" />;
    case 'harvested': return <ShoppingBasket className="h-4 w-4 text-orange-600" />;
    case 'removed': return <Shovel className="h-4 w-4 text-red-600" />;
    default: return null;
  }
}

export function StatusBadge({ status }: { status: PlantingStatus }) {
  const variant: React.ComponentProps<typeof Badge>['variant'] =
    status === 'nursery' ? 'secondary'
    : status === 'planted' ? 'default'
    : status === 'harvested' ? 'outline'
    : 'secondary';
  return <Badge variant={variant}>{formatPlantingStatus(status)}</Badge>;
}

export const getEventLabel = formatPlantingEventType;
export const getStatusLabel = formatPlantingStatus;
