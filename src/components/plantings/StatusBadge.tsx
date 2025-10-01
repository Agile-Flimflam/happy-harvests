import { Badge } from '@/components/ui/badge';
import { formatPlantingStatus } from '@/lib/plantings/utils';
import { PLANTING_STATUS, type PlantingStatus } from '@/lib/plantings/constants';

export default function StatusBadge({ status }: { status: PlantingStatus }) {
  const variant: React.ComponentProps<typeof Badge>['variant'] =
    status === PLANTING_STATUS.nursery ? 'secondary'
    : status === PLANTING_STATUS.planted ? 'default'
    : status === PLANTING_STATUS.harvested ? 'outline'
    : 'secondary';
  return <Badge variant={variant}>{formatPlantingStatus(status)}</Badge>;
}
