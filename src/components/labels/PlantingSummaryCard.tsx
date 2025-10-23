'use client';

import { Card } from '@/components/ui/card';
import { ShoppingBasket, Timer, Leaf, FlaskConical, Shovel } from 'lucide-react';
import type { PlantingSummary } from '@/lib/plantings/utils';

function formatDateLocal(s?: string | null) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}

export default function PlantingSummaryCard({ summary, endLabel }: { summary: PlantingSummary; endLabel?: string }) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3">
        {/* Top row: counts */}
        <div className="grid w-full grid-cols-3 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Nursery</span>
            <span className="font-medium">{summary.nurseryDays}d</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Planted</span>
            <span className="font-medium">{summary.fieldDays}d</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium">{summary.totalDays}d</span>
          </div>
        </div>

        {/* Bottom row: dates */}
        <div className="grid w-full grid-cols-3 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Nursery</span>
            <span className="font-medium">{formatDateLocal(summary.nurseryStartedDate)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Leaf className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Planted</span>
            <span className="font-medium">{formatDateLocal(summary.plantedDate)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {(endLabel === 'Removed') ? (
              <Shovel className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ShoppingBasket className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">{endLabel ?? 'Harvested'}</span>
            <span className="font-medium">{formatDateLocal(summary.endedDate)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
