'use client';

import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import {
  BadgeCheck,
  BedDouble,
  FlaskConical,
  Leaf,
  Loader2,
  MapPin,
  Sprout,
  Workflow,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InlineCreateSheet } from '@/components/ui/inline-create-sheet';
import type { QuickActionContext } from '@/app/(app)/actions';
import { BedForm } from '@/app/(app)/plots/_components/BedForm';
import { PlotForm } from '@/app/(app)/plots/_components/PlotForm';
import { CropVarietyForm } from '@/app/(app)/crop-varieties/_components/CropVarietyForm';
import { NurserySowForm } from '@/app/(app)/plantings/_components/NurserySowForm';
import { cn } from '@/lib/utils';
import { actionCreateNursery, type NurseryFormState } from '@/app/(app)/nurseries/_actions';
import { useActionState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type SheetKind = 'plot' | 'bed' | 'crop-variety' | 'nursery' | 'nursery-sow';

type QuickActionDescriptor = {
  id: 'start-planting' | 'record-nursery-sow' | 'add-plot-bed' | 'add-crop-variety';
  label: string;
  description: string;
  icon: ReactNode;
  ctaLabel: string;
  onClick: () => void;
  secondaryCta?: ReactNode;
  disabled?: boolean;
};

type QuickActionsHubProps = {
  context: QuickActionContext;
  className?: string;
};

export function QuickActionsHub({ context, className }: QuickActionsHubProps) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const hasCropVarieties = context.counts.cropVarieties > 0;
  const hasNurseries = context.counts.nurseries > 0;
  const hasPlots = context.counts.plots > 0;

  const openSheet = (kind: SheetKind) => {
    setSheet(kind);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheet(null);
    setSheetOpen(false);
  };

  const handleStartPlanting = () => {
    if (!hasCropVarieties) {
      openSheet('crop-variety');
      return;
    }
    const params = new URLSearchParams();
    params.set('mode', 'direct');
    router.push(`/plantings?${params.toString()}`);
  };

  const handleRecordNurserySow = () => {
    if (!hasCropVarieties) {
      openSheet('crop-variety');
      return;
    }
    if (!hasNurseries) {
      openSheet('nursery');
      return;
    }
    openSheet('nursery-sow');
  };

  const handleAddPlotBed = () => {
    openSheet(hasPlots ? 'bed' : 'plot');
  };

  const quickActions: QuickActionDescriptor[] = [
    {
      id: 'start-planting',
      label: 'Start planting',
      description: 'Launch planting wizard with the same right-side flow as Plantings.',
      icon: <Sprout className="h-5 w-5 text-emerald-600" aria-hidden />,
      ctaLabel: 'Start planting',
      onClick: handleStartPlanting,
    },
    {
      id: 'record-nursery-sow',
      label: 'Record nursery sow',
      description: hasNurseries
        ? 'Open nursery sow flow with existing nurseries.'
        : 'Add a nursery before recording sowings.',
      icon: <FlaskConical className="h-5 w-5 text-blue-600" aria-hidden />,
      ctaLabel: hasNurseries ? 'Record sow' : 'Add nursery',
      onClick: handleRecordNurserySow,
    },
    {
      id: 'add-plot-bed',
      label: 'Add plot/bed',
      description: hasPlots
        ? 'Create a new bed inside an existing plot.'
        : 'Create your first plot to add beds.',
      icon: <MapPin className="h-5 w-5 text-orange-600" aria-hidden />,
      ctaLabel: hasPlots ? 'Add bed' : 'Add plot',
      onClick: handleAddPlotBed,
    },
    {
      id: 'add-crop-variety',
      label: 'Add crop variety',
      description: hasCropVarieties
        ? 'Expand your catalog for future plantings.'
        : 'Create your first crop variety to unlock flows.',
      icon: <Leaf className="h-5 w-5 text-lime-600" aria-hidden />,
      ctaLabel: hasCropVarieties ? 'Add another variety' : 'Add first variety',
      onClick: () => openSheet('crop-variety'),
    },
  ];

  const activePlot = context.plots[0] ?? null;
  const sheetTitle = sheet === 'bed' ? 'Create bed' : 'Create plot';
  const sheetDescription =
    sheet === 'bed'
      ? 'Add a bed inside an existing plot.'
      : 'Create a plot with a location to start adding beds.';

  return (
    <div
      className={cn(
        'rounded-xl border bg-card/70 shadow-sm ring-1 ring-border/50 backdrop-blur-sm',
        className
      )}
    >
      <div className="flex flex-col gap-2 border-b px-4 pb-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Workflow className="h-4 w-4" aria-hidden />
          <span>Quick Actions</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <BadgeCheck className="h-3 w-3 text-emerald-600" aria-hidden />
            {context.counts.cropVarieties} varieties
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <BedDouble className="h-3 w-3 text-blue-600" aria-hidden />
            {context.counts.beds} beds
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <MapPin className="h-3 w-3 text-orange-600" aria-hidden />
            {context.counts.plots} plots
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <FlaskConical className="h-3 w-3 text-blue-500" aria-hidden />
            {context.counts.nurseries} nurseries
          </span>
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:p-6 sm:grid-cols-2">
        {quickActions.map((qa) => (
          <Card key={qa.id} className="h-full shadow-none border-muted/70">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  {qa.icon}
                </div>
                <CardTitle className="text-base">{qa.label}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{qa.description}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={qa.onClick} className="gap-2">
                  {qa.ctaLabel}
                </Button>
                {qa.secondaryCta}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Inline create sheets for dependencies */}
      <InlineCreateSheet
        title={sheetTitle}
        description={sheetDescription}
        open={sheetOpen && (sheet === 'plot' || sheet === 'bed')}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else if (sheet === null) setSheet('plot');
        }}
        primaryAction={{
          label: sheet === 'plot' ? 'Create plot' : 'Create bed',
          formId: sheet === 'plot' ? 'quickPlotForm' : 'quickBedForm',
        }}
        secondaryAction={{ label: 'Cancel', onClick: closeSheet, variant: 'ghost' }}
        side="right"
      >
        {sheet === 'plot' ? (
          <PlotForm locations={context.locations} closeDialog={closeSheet} formId="quickPlotForm" />
        ) : (
          <BedForm
            plots={context.plots}
            closeDialog={closeSheet}
            formId="quickBedForm"
            initialPlotId={activePlot?.plot_id ?? null}
          />
        )}
      </InlineCreateSheet>

      <InlineCreateSheet
        title="Add crop variety"
        description="Unlock planting flows by adding your first crop variety."
        open={sheetOpen && sheet === 'crop-variety'}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheet('crop-variety');
        }}
        primaryAction={{ label: 'Save variety', formId: 'quickCropVarietyForm' }}
        secondaryAction={{ label: 'Cancel', onClick: closeSheet, variant: 'ghost' }}
        side="right"
      >
        <CropVarietyForm
          crops={context.crops}
          closeDialog={closeSheet}
          formId="quickCropVarietyForm"
        />
      </InlineCreateSheet>

      <InlineCreateSheet
        title="Add nursery"
        description="Create a nursery to record sowings and transplants."
        open={sheetOpen && sheet === 'nursery'}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheet('nursery');
        }}
        primaryAction={{ label: 'Save nursery', formId: 'quickNurseryForm' }}
        secondaryAction={{ label: 'Cancel', onClick: closeSheet, variant: 'ghost' }}
        side="right"
      >
        <QuickNurseryForm locations={context.locations} onCompleted={closeSheet} />
      </InlineCreateSheet>

      <InlineCreateSheet
        title="Record nursery sow"
        description="Log a nursery sowing with selected variety and nursery."
        open={sheetOpen && sheet === 'nursery-sow'}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheet('nursery-sow');
        }}
        primaryAction={{ label: 'Save sowing', formId: 'quickNurserySowForm' }}
        secondaryAction={{ label: 'Cancel', onClick: closeSheet, variant: 'ghost' }}
        side="right"
      >
        <NurserySowForm
          cropVarieties={context.cropVarieties}
          nurseries={context.nurseries}
          closeDialog={closeSheet}
          formId="quickNurserySowForm"
        />
      </InlineCreateSheet>
    </div>
  );
}

type QuickNurseryFormProps = {
  locations: QuickActionContext['locations'];
  onCompleted: () => void;
};

function QuickNurseryForm({ locations, onCompleted }: QuickNurseryFormProps) {
  const initial: NurseryFormState = {
    ok: true,
    data: { nursery: null },
    message: '',
    correlationId: 'init',
  };
  const [state, submitAction] = useActionState<NurseryFormState, FormData>(
    actionCreateNursery,
    initial
  );
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [locationId, setLocationId] = useState<string>('');
  const [notes, setNotes] = useState('');

  if (state?.message) {
    if (!state.ok) {
      const ref = state.correlationId ? ` (Ref: ${state.correlationId})` : '';
      toast.error(`${state.message}${ref}`);
    } else {
      toast.success(state.message);
      onCompleted();
    }
  }

  const onSubmit = (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    const fd = new FormData();
    fd.append('name', name.trim());
    fd.append('location_id', locationId);
    if (notes.trim()) fd.append('notes', notes.trim());
    startTransition(() => submitAction(fd));
  };

  return (
    <form id="quickNurseryForm" onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nurseryName">Name</Label>
        <Input
          id="nurseryName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          placeholder="Propagation house"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nurseryLocation">Location</Label>
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger id="nurseryLocation">
            <SelectValue placeholder="Select a location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="nurseryNotes">Notes (optional)</Label>
        <Input
          id="nurseryNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Light, cover, bench details..."
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FlaskConical className="h-3 w-3" aria-hidden />
        <span>We will revalidate nurseries after save.</span>
      </div>
      {pending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Saving nursery...
        </div>
      ) : null}
    </form>
  );
}
