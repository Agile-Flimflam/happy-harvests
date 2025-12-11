'use client';

import { useActionState } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Tables } from '@/lib/supabase-server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FlowShell } from '@/components/ui/flow-shell';
import { Stepper } from '@/components/ui/stepper';
import { InlineCreateSheet } from '@/components/ui/inline-create-sheet';
import { StickyActionBar } from '@/components/ui/sticky-action-bar';
import { toast } from 'sonner';
import { Leaf, MapPin, Layers, Sprout, Plus, Save, Trash2, Undo2, RefreshCcw } from 'lucide-react';
import { CropVarietyForm } from '@/app/(app)/crop-varieties/_components/CropVarietyForm';
import { LocationForm } from '@/app/(app)/locations/_components/LocationForm';
import { PlotForm } from '@/app/(app)/plots/_components/PlotForm';
import { BedForm } from '@/app/(app)/plots/_components/BedForm';
import { actionCreateNursery, type NurseryFormState } from '@/app/(app)/nurseries/_actions';
import {
  actionDirectSeed,
  actionNurserySow,
  clearPlantingDraft,
  savePlantingDraft,
  bulkCreateDirectSeedPlantings,
  savePlantingTemplateAction,
  deletePlantingTemplateAction,
  type BulkDirectSeedInput,
  type PlantingFormState,
  type BulkDirectSeedResult,
  type PlantingDraft,
} from '../_actions';
import { createCorrelationId } from '@/lib/action-result';
import {
  createFlowTracker,
  createInlineSheetTracker,
  trackTelemetry,
  trackRetry,
  type FlowTracker,
  type InlineSheetTracker,
} from '@/lib/telemetry';
import type { QuickActionContext } from '../../actions';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useIsMobile } from '@/hooks/use-mobile';
import type { PlantingDefaults, PlantingPrefs, PlantingTemplate } from '@/lib/planting-prefs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type LocationOption = Pick<Tables<'locations'>, 'id' | 'name'>;
type PlotOption = Pick<Tables<'plots'>, 'plot_id' | 'name' | 'location_id'>;
type BedOption = Pick<Tables<'beds'>, 'id' | 'name' | 'plot_id'> & {
  plots?: { location_id: string | null } | null;
};
type BedWithLocation = Tables<'beds'> & { plots?: { location_id: string | null } | null };
type NurseryOption = { id: string; name: string };
type VarietyOption = {
  id: number;
  name: string;
  latin_name: string;
  crops?: { name: string } | null;
};

type PlantingsPageContentProps = {
  locations: LocationOption[];
  plots: PlotOption[];
  beds: BedOption[];
  nurseries: NurseryOption[];
  cropVarieties: VarietyOption[];
  scheduleDate?: string;
  defaultBedId?: number | null;
  defaultNurseryId?: string | null;
  creationContext?: QuickActionContext;
  serverDraft?: PlantingDraft | null;
  optionsError?: string | null;
  prefs?: PlantingPrefs | null;
  templates?: PlantingTemplate[];
};

type WizardStep = 'location' | 'plot' | 'nursery' | 'variety' | 'schedule';
type LocationRecord = Tables<'locations'>;
type PlotRecord = Tables<'plots'>;

type WizardFieldErrors = {
  locationId?: string;
  plotId?: string;
  bedId?: string;
  nurseryId?: string;
  varietyId?: string;
  qty?: string;
  date?: string;
  weightGrams?: string;
  notes?: string;
  attachment?: string;
};

export function PlantingsPageContent({
  locations,
  plots,
  beds,
  nurseries,
  cropVarieties,
  scheduleDate,
  defaultBedId = null,
  defaultNurseryId = null,
  creationContext,
  serverDraft = null,
  optionsError = null,
  prefs = null,
  templates = [],
}: PlantingsPageContentProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const prefDefaults = prefs?.defaults;
  const defaultPlotFromBed = useMemo(() => {
    if (defaultBedId != null) {
      const bedMatch = beds.find((b) => b.id === defaultBedId);
      if (bedMatch?.plot_id) return bedMatch.plot_id;
    }
    return plots[0]?.plot_id ?? null;
  }, [beds, defaultBedId, plots]);
  const baseDefaults = useMemo(
    (): PlantingDraft => ({
      locationId:
        prefDefaults?.locationId ?? creationContext?.locations?.[0]?.id ?? locations[0]?.id ?? null,
      plotId: prefDefaults?.plotId ?? defaultPlotFromBed,
      bedId: prefDefaults?.bedId ?? defaultBedId,
      nurseryId: prefDefaults?.nurseryId ?? defaultNurseryId ?? nurseries[0]?.id ?? null,
      varietyId: prefDefaults?.varietyId ?? cropVarieties[0]?.id ?? null,
      qty: prefDefaults?.qty ?? null,
      weightGrams: prefDefaults?.weightGrams ?? null,
      date: prefDefaults?.date ?? scheduleDate ?? '',
      notes: prefDefaults?.notes ?? '',
    }),
    [
      creationContext?.locations,
      cropVarieties,
      defaultBedId,
      defaultNurseryId,
      defaultPlotFromBed,
      locations,
      prefDefaults?.bedId,
      prefDefaults?.date,
      prefDefaults?.locationId,
      prefDefaults?.notes,
      prefDefaults?.nurseryId,
      prefDefaults?.plotId,
      prefDefaults?.qty,
      prefDefaults?.varietyId,
      prefDefaults?.weightGrams,
      nurseries,
      scheduleDate,
    ]
  );
  const [step, setStep] = useState<WizardStep>('location');
  const [mode, setMode] = useState<'direct' | 'nursery'>(
    prefDefaults?.mode ?? (defaultNurseryId ? 'nursery' : 'direct')
  );
  const [locationId, setLocationId] = useState<string | null>(baseDefaults.locationId ?? null);
  const [plotId, setPlotId] = useState<number | null>(baseDefaults.plotId ?? null);
  const [bedId, setBedId] = useState<number | null>(baseDefaults.bedId ?? null);
  const [nurseryId, setNurseryId] = useState<string | null>(baseDefaults.nurseryId ?? null);
  const [varietyId, setVarietyId] = useState<number | null>(baseDefaults.varietyId ?? null);
  const [qty, setQty] = useState<string>(baseDefaults.qty != null ? String(baseDefaults.qty) : '');
  const [weightGrams, setWeightGrams] = useState<string>(
    baseDefaults.weightGrams != null ? String(baseDefaults.weightGrams) : ''
  );
  const [date, setDate] = useState<string>(baseDefaults.date ?? '');
  const [notes, setNotes] = useState<string>(baseDefaults.notes ?? '');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<WizardFieldErrors>({});
  const [hasDraft, setHasDraft] = useState(false);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkBeds, setBulkBeds] = useState<number[]>([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [pendingBulk, setPendingBulk] = useState<BulkDirectSeedInput | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkDirectSeedResult | null>(null);
  const [lastBulkPayload, setLastBulkPayload] = useState<BulkDirectSeedInput | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [isSavingTemplate, startSaveTemplate] = useTransition();

  const flowCorrelationId = useMemo(() => createCorrelationId(), []);
  const flowTrackerRef = useRef<FlowTracker | null>(null);
  if (!flowTrackerRef.current) {
    flowTrackerRef.current = createFlowTracker({
      flowId: 'planting-wizard',
      correlationId: flowCorrelationId,
      variant: creationContext ? 'quick-action' : undefined,
    });
  }
  const flowTracker = flowTrackerRef.current;
  const stepRef = useRef<WizardStep>('location');

  const locationSheetTracker = useMemo<InlineSheetTracker>(
    () => createInlineSheetTracker('location-inline', 'inline-sheet', flowCorrelationId),
    [flowCorrelationId]
  );
  const plotSheetTracker = useMemo<InlineSheetTracker>(
    () => createInlineSheetTracker('plot-inline', 'inline-sheet', flowCorrelationId),
    [flowCorrelationId]
  );
  const bedSheetTracker = useMemo<InlineSheetTracker>(
    () => createInlineSheetTracker('bed-inline', 'inline-sheet', flowCorrelationId),
    [flowCorrelationId]
  );
  const nurserySheetTracker = useMemo<InlineSheetTracker>(
    () => createInlineSheetTracker('nursery-inline', 'inline-sheet', flowCorrelationId),
    [flowCorrelationId]
  );
  const varietySheetTracker = useMemo<InlineSheetTracker>(
    () => createInlineSheetTracker('variety-inline', 'inline-sheet', flowCorrelationId),
    [flowCorrelationId]
  );
  const locationSheetCompletedRef = useRef(false);
  const plotSheetCompletedRef = useRef(false);
  const bedSheetCompletedRef = useRef(false);
  const nurserySheetCompletedRef = useRef(false);
  const varietySheetCompletedRef = useRef(false);
  const [templateList, setTemplateList] = useState<PlantingTemplate[]>(templates);

  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [plotSheetOpen, setPlotSheetOpen] = useState(false);
  const [bedSheetOpen, setBedSheetOpen] = useState(false);
  const [nurserySheetOpen, setNurserySheetOpen] = useState(false);
  const [varietySheetOpen, setVarietySheetOpen] = useState(false);

  useEffect(() => {
    setTemplateList(templates);
  }, [templates]);

  useEffect(() => {
    stepRef.current = step;
    flowTracker.markStepView(step);
  }, [flowTracker, step]);

  useEffect(
    () => () => {
      flowTracker.markDrop('unmount', stepRef.current);
    },
    [flowTracker]
  );

  const nurseryInitial: NurseryFormState = {
    ok: true,
    data: { nursery: null },
    message: '',
    correlationId: 'init',
  };
  const [nurseryCreateState, nurseryCreateAction] = useActionState<NurseryFormState, FormData>(
    actionCreateNursery,
    nurseryInitial
  );

  const locationRecords: LocationRecord[] = useMemo(
    () =>
      locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        created_at: '',
        city: null,
        latitude: null,
        longitude: null,
        notes: null,
        state: null,
        street: null,
        timezone: null,
        zip: null,
      })),
    [locations]
  );

  const plotRecordsForBedForm: Array<PlotRecord & { locations?: LocationRecord | null }> = useMemo(
    () =>
      plots.map((p) => ({
        plot_id: p.plot_id,
        name: p.name,
        location_id: p.location_id,
        created_at: '',
        locations: locationRecords.find((loc) => loc.id === p.location_id) ?? null,
      })),
    [locationRecords, plots]
  );

  const bedLookup = useMemo(() => {
    const map = new Map<number, BedOption>();
    beds.forEach((b) => map.set(b.id, b));
    return map;
  }, [beds]);

  const recentBeds = prefs?.recents?.bedIds ?? [];
  const recentNurseries = prefs?.recents?.nurseryIds ?? [];
  const recentVarieties = prefs?.recents?.varietyIds ?? [];

  useEffect(() => {
    if (!nurseryCreateState?.message) return;
    if (!nurseryCreateState.ok) {
      nurserySheetTracker.failed(nurseryCreateState.code);
      toast.error(
        nurseryCreateState.correlationId
          ? `${nurseryCreateState.message} (Ref: ${nurseryCreateState.correlationId})`
          : nurseryCreateState.message
      );
      return;
    }
    nurserySheetCompletedRef.current = true;
    nurserySheetTracker.succeeded();
    const created = nurseryCreateState.data?.nursery;
    if (created) {
      toast.success(nurseryCreateState.message);
      handleNurserySheetOpenChange(false);
      setNurseryId(created.id);
      router.refresh();
    }
  }, [nurseryCreateState, router]);

  const stepperItems = [
    { id: 'location', label: 'Location', title: 'Location' },
    { id: 'plot', label: 'Plot / Bed', title: 'Plot / Bed' },
    { id: 'nursery', label: 'Nursery (optional)', title: 'Nursery (optional)' },
    { id: 'variety', label: 'Variety', title: 'Variety' },
    { id: 'schedule', label: 'Schedule & notes', title: 'Schedule & notes' },
  ] as const;

  const plotsForLocation = useMemo(
    () => plots.filter((p) => !locationId || p.location_id === locationId),
    [plots, locationId]
  );
  const bedsForPlot = useMemo(
    () =>
      beds.filter(
        (b) =>
          (!plotId || b.plot_id === plotId) && (!locationId || b.plots?.location_id === locationId)
      ),
    [beds, plotId, locationId]
  );

  useEffect(() => {
    if (plotsForLocation.length > 0 && !plotsForLocation.find((p) => p.plot_id === plotId)) {
      setPlotId(plotsForLocation[0]?.plot_id ?? null);
    }
  }, [plotsForLocation, plotId]);

  useEffect(() => {
    if (bedsForPlot.length > 0 && !bedsForPlot.find((b) => b.id === bedId)) {
      setBedId(bedsForPlot[0]?.id ?? null);
    }
  }, [bedsForPlot, bedId]);

  useEffect(() => {
    if (!isBulkMode) return;
    setBulkBeds((prev) => prev.filter((id) => bedsForPlot.some((b) => b.id === id)));
  }, [bedsForPlot, isBulkMode]);

  useEffect(() => {
    if (mode === 'nursery') {
      setIsBulkMode(false);
      setBulkBeds([]);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === 'direct' && !isBulkMode) {
      setBulkBeds(bedId ? [bedId] : []);
    }
  }, [bedId, isBulkMode, mode]);

  const clearFieldError = (key: keyof WizardFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleLocationSheetOpenChange = (open: boolean) => {
    if (open) {
      locationSheetCompletedRef.current = false;
      locationSheetTracker.opened();
    } else if (!locationSheetCompletedRef.current) {
      locationSheetTracker.failed('cancel');
    }
    setLocationSheetOpen(open);
  };

  const handlePlotSheetOpenChange = (open: boolean) => {
    if (open) {
      plotSheetCompletedRef.current = false;
      plotSheetTracker.opened();
    } else if (!plotSheetCompletedRef.current) {
      plotSheetTracker.failed('cancel');
    }
    setPlotSheetOpen(open);
  };

  const handleBedSheetOpenChange = (open: boolean) => {
    if (open) {
      bedSheetCompletedRef.current = false;
      bedSheetTracker.opened();
    } else if (!bedSheetCompletedRef.current) {
      bedSheetTracker.failed('cancel');
    }
    setBedSheetOpen(open);
  };

  const handleNurserySheetOpenChange = (open: boolean) => {
    if (open) {
      nurserySheetCompletedRef.current = false;
      nurserySheetTracker.opened();
    } else if (!nurserySheetCompletedRef.current) {
      nurserySheetTracker.failed('cancel');
    }
    setNurserySheetOpen(open);
  };

  const handleVarietySheetOpenChange = (open: boolean) => {
    if (open) {
      varietySheetCompletedRef.current = false;
      varietySheetTracker.opened();
    } else if (!varietySheetCompletedRef.current) {
      varietySheetTracker.failed('cancel');
    }
    setVarietySheetOpen(open);
  };

  const validateStep = (currentStep: WizardStep): boolean => {
    if (currentStep === 'location' && !locationId) {
      setFieldErrors((prev) => ({ ...prev, locationId: 'Select a location to continue.' }));
      toast.error('Select a location to continue.');
      return false;
    }
    if (currentStep === 'plot') {
      const hasPlot = Boolean(plotId);
      const hasBed =
        mode === 'nursery' ? true : Boolean(bedId) || (isBulkMode && bulkBeds.length > 0);
      if (!hasPlot) {
        setFieldErrors((prev) => ({ ...prev, plotId: 'Select a plot to continue.' }));
        toast.error('Select a plot to continue.');
        return false;
      }
      if (!hasBed) {
        setFieldErrors((prev) => ({ ...prev, bedId: 'Select a bed for direct sow.' }));
        toast.error('Select a bed for direct sow.');
        return false;
      }
    }
    if (currentStep === 'nursery' && mode === 'nursery' && !nurseryId) {
      setFieldErrors((prev) => ({ ...prev, nurseryId: 'Select a nursery to continue.' }));
      toast.error('Select a nursery to continue.');
      return false;
    }
    if (currentStep === 'variety' && !varietyId) {
      setFieldErrors((prev) => ({ ...prev, varietyId: 'Select a variety to continue.' }));
      toast.error('Select a variety to continue.');
      return false;
    }
    return true;
  };

  const handleLocationCreated = (created: LocationRecord) => {
    setLocationId(created.id);
    setPlotId(null);
    setBedId(null);
    locationSheetCompletedRef.current = true;
    locationSheetTracker.succeeded();
    handleLocationSheetOpenChange(false);
    router.refresh();
  };

  const handlePlotCreated = (created: PlotRecord) => {
    if (created.location_id) {
      setLocationId(created.location_id);
    }
    setPlotId(created.plot_id ?? null);
    setBedId(null);
    plotSheetCompletedRef.current = true;
    plotSheetTracker.succeeded();
    handlePlotSheetOpenChange(false);
    router.refresh();
  };

  const handleBedCreated = (created: BedWithLocation) => {
    if (created.plots?.location_id) {
      setLocationId(created.plots.location_id);
    }
    if (created.plot_id) {
      setPlotId(created.plot_id);
    }
    setBedId(created.id);
    bedSheetCompletedRef.current = true;
    bedSheetTracker.succeeded();
    handleBedSheetOpenChange(false);
    router.refresh();
  };

  const currentTemplatePayload = useMemo((): PlantingDefaults => {
    const qtyNumber = qty ? Number(qty) : null;
    const weightNumber = weightGrams ? Number(weightGrams) : null;
    return {
      locationId,
      plotId,
      bedId,
      nurseryId,
      varietyId,
      mode,
      qty: Number.isFinite(qtyNumber) ? qtyNumber : null,
      weightGrams: Number.isFinite(weightNumber) ? weightNumber : null,
      date: date || null,
      notes: notes || null,
    };
  }, [bedId, date, locationId, mode, notes, nurseryId, plotId, qty, varietyId, weightGrams]);

  const handleApplyTemplate = (templateId: string) => {
    const tpl = templateList.find((t) => t.id === templateId);
    if (!tpl) return;
    applyDraft(tpl.payload);
    setSelectedTemplateId(templateId);
    toast.success(`Applied template “${tpl.name}”.`);
  };

  const handleSaveTemplate = (overwrite?: boolean) => {
    if (!templateName.trim()) {
      toast.error('Enter a template name first.');
      return;
    }
    startSaveTemplate(() => {
      savePlantingTemplateAction({
        name: templateName,
        payload: currentTemplatePayload,
        overwrite: overwrite ?? false,
      }).then((res) => {
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setTemplateList(res.prefs.templates ?? []);
        const saved = res.prefs.templates?.find(
          (t) => t.name.trim().toLowerCase() === templateName.trim().toLowerCase()
        );
        setSelectedTemplateId(saved?.id ?? null);
        toast.success(`Saved template “${templateName}”.`);
      });
    });
  };

  const handleDeleteTemplate = () => {
    if (!selectedTemplateId) return;
    startSaveTemplate(() => {
      deletePlantingTemplateAction(selectedTemplateId).then((res) => {
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setTemplateList(res.prefs.templates ?? []);
        setSelectedTemplateId(null);
        toast.success('Template removed.');
      });
    });
  };

  const runBulkCreate = (payload: BulkDirectSeedInput) => {
    setPendingBulk(null);
    setBulkDialogOpen(false);
    setLastBulkPayload(payload);
    startSubmit(() => {
      bulkCreateDirectSeedPlantings(payload).then((res) => {
        setBulkResult(res);
        if (res.successes.length) {
          toast.success(res.message);
          restoreDefaults();
          setBulkBeds([]);
        }
        if (res.failures.length) {
          toast.error(`Some beds failed: ${res.failures.map((f) => f.bedId).join(', ')}`);
          setBulkBeds(res.failures.map((f) => f.bedId));
        }
        const hasFailures = res.failures.length > 0;
        trackTelemetry({
          name: 'flow_step_result',
          properties: {
            flowId: 'planting-wizard',
            stepId: 'schedule',
            outcome: hasFailures ? 'error' : 'success',
            errorCode: hasFailures ? 'bulk_partial_failure' : undefined,
            correlationId: flowCorrelationId,
            elapsedMs: flowTracker.getElapsedMs(),
          },
        });
        router.refresh();
      });
    });
  };

  const handleRetryBulkFailures = () => {
    if (!bulkResult?.failures.length || !lastBulkPayload) return;
    const failedIds = bulkResult.failures.map((f) => f.bedId);
    const retryPayload: BulkDirectSeedInput = { ...lastBulkPayload, bedIds: failedIds };
    setPendingBulk(retryPayload);
    setBulkDialogOpen(true);
    trackRetry('bulk-direct-seed', flowCorrelationId);
  };

  const LOCAL_STORAGE_KEY = 'plantingDraftV1';

  const restoreDefaults = useCallback(() => {
    setFieldErrors({});
    setLocationId(baseDefaults.locationId ?? null);
    setPlotId(baseDefaults.plotId ?? null);
    setBedId(baseDefaults.bedId ?? null);
    setNurseryId(baseDefaults.nurseryId ?? null);
    setVarietyId(baseDefaults.varietyId ?? null);
    setMode(prefDefaults?.mode ?? (defaultNurseryId ? 'nursery' : 'direct'));
    setQty(baseDefaults.qty != null ? String(baseDefaults.qty) : '');
    setWeightGrams(baseDefaults.weightGrams != null ? String(baseDefaults.weightGrams) : '');
    setDate(baseDefaults.date ?? '');
    setNotes(baseDefaults.notes ?? '');
  }, [baseDefaults, defaultNurseryId, prefDefaults?.mode]);

  const applyDraft = useCallback((draft: PlantingDraft) => {
    setFieldErrors({});
    if (draft.locationId !== undefined) setLocationId(draft.locationId ?? null);
    if (draft.plotId !== undefined) setPlotId(draft.plotId ?? null);
    if (draft.bedId !== undefined) setBedId(draft.bedId ?? null);
    if (draft.nurseryId !== undefined) setNurseryId(draft.nurseryId ?? null);
    if (draft.varietyId !== undefined) setVarietyId(draft.varietyId ?? null);
    if (draft.mode) setMode(draft.mode);
    if (draft.qty !== undefined) setQty(draft.qty != null ? String(draft.qty) : '');
    if (draft.weightGrams !== undefined) {
      setWeightGrams(draft.weightGrams != null ? String(draft.weightGrams) : '');
    }
    if (draft.date !== undefined) setDate(draft.date ?? '');
    if (draft.notes !== undefined) setNotes(draft.notes ?? '');
    setHasDraft(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PlantingDraft;
        applyDraft(parsed);
        setResumeMessage('Draft restored from this device.');
        return;
      } catch {
        // ignore parse errors
      }
    }
    if (serverDraft) {
      applyDraft(serverDraft);
      setResumeMessage('Draft restored from your account.');
    }
  }, [applyDraft, serverDraft]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const qtyNumber = qty ? Number(qty) : null;
    const weightNumber = weightGrams ? Number(weightGrams) : null;
    const draftPayload: PlantingDraft = {
      locationId,
      plotId,
      bedId,
      nurseryId,
      varietyId,
      mode,
      qty: Number.isFinite(qtyNumber) ? qtyNumber : null,
      weightGrams: Number.isFinite(weightNumber) ? weightNumber : null,
      date: date || null,
      notes: notes || null,
    };
    const timer = window.setTimeout(() => {
      setHasDraft(true);
      try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(draftPayload));
      } catch {
        // ignore storage errors
      }
      savePlantingDraft(draftPayload)
        .then((res) => {
          if ('error' in res && res.error) {
            setSaveError(res.error);
            return;
          }
          setSaveError(null);
          setLastSavedAt(new Date());
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Unable to save draft.';
          setSaveError(message);
        });
    }, 800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [date, bedId, locationId, mode, notes, nurseryId, plotId, qty, weightGrams, varietyId]);

  const handleDiscardDraft = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    setHasDraft(false);
    setResumeMessage(null);
    setLastSavedAt(null);
    setSaveError(null);
    restoreDefaults();
    clearPlantingDraft();
    flowTracker.markDrop('cancel', stepRef.current);
    toast.success('Draft discarded.');
  };

  const canContinueLocation = Boolean(locationId);
  const canContinuePlot =
    mode === 'nursery' ? true : Boolean(bedId) || (isBulkMode && bulkBeds.length > 0);
  const canContinueNursery = mode === 'direct' ? true : Boolean(nurseryId);
  const canContinueVariety = Boolean(varietyId);
  const canSubmit = Boolean(
    date &&
    qty &&
    varietyId &&
    (mode === 'nursery' ? nurseryId : isBulkMode ? bulkBeds.length > 0 : bedId)
  );

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locationId, locations]
  );
  const selectedPlot = useMemo(() => plots.find((p) => p.plot_id === plotId), [plotId, plots]);
  const selectedBed = useMemo(() => beds.find((b) => b.id === bedId), [bedId, beds]);
  const selectedNursery = useMemo(
    () => nurseries.find((n) => n.id === nurseryId),
    [nurseryId, nurseries]
  );
  const selectedVariety = useMemo(
    () => cropVarieties.find((v) => v.id === varietyId),
    [cropVarieties, varietyId]
  );

  const goNext = () => {
    const order: WizardStep[] = ['location', 'plot', 'nursery', 'variety', 'schedule'];
    const idx = order.indexOf(step);
    if (idx < order.length - 1 && validateStep(step)) setStep(order[idx + 1]);
  };
  const goPrev = () => {
    const order: WizardStep[] = ['location', 'plot', 'nursery', 'variety', 'schedule'];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  };

  const handleSubmit = () => {
    flowTracker.markSubmit('schedule');
    const missingQty = !qty;
    const missingDate = !date;
    const qtyNumber = Number(qty);
    const weightNumber = weightGrams ? Number(weightGrams) : null;
    if (!validateStep('variety')) return;
    if (missingQty || missingDate) {
      setFieldErrors((prev) => ({
        ...prev,
        qty: missingQty ? 'Enter a quantity.' : prev.qty,
        date: missingDate ? 'Choose a date.' : prev.date,
      }));
      toast.error('Please complete required fields.');
      flowTracker.markResult('schedule', 'validation', 'missing_required');
      return;
    }
    setFieldErrors({});
    if (!Number.isFinite(qtyNumber) || qtyNumber <= 0) {
      setFieldErrors((prev) => ({ ...prev, qty: 'Quantity must be a positive number.' }));
      toast.error('Quantity must be a positive number.');
      flowTracker.markResult('schedule', 'validation', 'invalid_qty');
      return;
    }
    const parsedWeight =
      weightNumber != null && Number.isFinite(weightNumber) ? weightNumber : null;
    if (mode === 'direct' && isBulkMode) {
      const targets = bulkBeds.length ? bulkBeds : bedId ? [bedId] : [];
      if (!targets.length) {
        setFieldErrors((prev) => ({ ...prev, bedId: 'Select at least one bed.' }));
        toast.error('Select at least one bed.');
        return;
      }
      if (!varietyId) {
        setFieldErrors((prev) => ({ ...prev, varietyId: 'Pick a variety.' }));
        toast.error('Select a variety before bulk creating.');
        return;
      }
      setBulkResult(null);
      const payload: BulkDirectSeedInput = {
        bedIds: targets,
        crop_variety_id: varietyId ?? 0,
        qty: qtyNumber,
        event_date: date,
        notes: notes || undefined,
        weight_grams: parsedWeight,
      };
      setPendingBulk(payload);
      setBulkDialogOpen(true);
      return;
    }
    const fd = new FormData();
    fd.append('crop_variety_id', String(varietyId));
    fd.append('qty', String(qtyNumber));
    fd.append('event_date', date);
    if (notes) fd.append('notes', notes);
    if (parsedWeight != null) fd.append('weight_grams', String(parsedWeight));
    if (attachment) fd.append('attachment', attachment);

    const plantingInitial: PlantingFormState = {
      ok: true,
      data: { planting: null, undoId: null },
      message: '',
      correlationId: 'init',
    };
    startSubmit(() => {
      if (mode === 'nursery') {
        fd.append('nursery_id', String(nurseryId));
        actionNurserySow(plantingInitial, fd).then((res) => {
          if (!res.ok) {
            const mapped: WizardFieldErrors = {
              varietyId: res.fieldErrors?.crop_variety_id?.[0],
              qty: res.fieldErrors?.qty?.[0],
              nurseryId: res.fieldErrors?.nursery_id?.[0],
              date: res.fieldErrors?.event_date?.[0],
              weightGrams: res.fieldErrors?.weight_grams?.[0],
              notes: res.fieldErrors?.notes?.[0],
            };
            setFieldErrors(mapped);
            const ref = res.correlationId ? ` (Ref: ${res.correlationId})` : '';
            toast.error(`${res.message}${ref}`);
            flowTracker.markResult('schedule', 'error', res.code);
            return;
          }
          flowTracker.markResult('schedule', 'success');
          toast.success(res.message ?? 'Nursery sow recorded.');
          router.refresh();
        });
      } else {
        fd.append('bed_id', String(bedId));
        actionDirectSeed(plantingInitial, fd).then((res) => {
          if (!res.ok) {
            const mapped: WizardFieldErrors = {
              varietyId: res.fieldErrors?.crop_variety_id?.[0],
              qty: res.fieldErrors?.qty?.[0],
              bedId: res.fieldErrors?.bed_id?.[0],
              date: res.fieldErrors?.event_date?.[0],
              weightGrams: res.fieldErrors?.weight_grams?.[0],
            };
            setFieldErrors(mapped);
            const ref = res.correlationId ? ` (Ref: ${res.correlationId})` : '';
            toast.error(`${res.message}${ref}`);
            flowTracker.markResult('schedule', 'error', res.code);
            return;
          }
          flowTracker.markResult('schedule', 'success');
          toast.success(res.message ?? 'Direct sow recorded.');
          router.refresh();
        });
      }
    });
  };

  const renderStepContent = () => {
    switch (step) {
      case 'location':
        return (
          <div className="space-y-3">
            <Label>Select location</Label>
            <Select
              value={locationId ?? ''}
              onValueChange={(v) => {
                clearFieldError('locationId');
                setLocationId(v || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.locationId ? (
              <p className="text-xs text-destructive">{fieldErrors.locationId}</p>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => handleLocationSheetOpenChange(true)}>
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Add location
            </Button>
          </div>
        );
      case 'plot':
        return (
          <div className="space-y-3">
            <Label>Plot</Label>
            <Select
              value={plotId ? String(plotId) : ''}
              onValueChange={(v) => {
                clearFieldError('plotId');
                setPlotId(Number(v));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a plot" />
              </SelectTrigger>
              <SelectContent>
                {plotsForLocation.map((plot) => (
                  <SelectItem key={plot.plot_id} value={String(plot.plot_id)}>
                    {plot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.plotId ? (
              <p className="text-xs text-destructive">{fieldErrors.plotId}</p>
            ) : null}
            <div className="flex items-center gap-2">
              <Label>Bed (required for direct plantings)</Label>
              {prefDefaults?.bedId ? <Badge variant="outline">Default</Badge> : null}
            </div>
            <Select
              value={bedId ? String(bedId) : ''}
              onValueChange={(v) => {
                clearFieldError('bedId');
                setBedId(Number(v));
              }}
              disabled={mode === 'nursery'}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={mode === 'nursery' ? 'Not required for nursery' : 'Select a bed'}
                />
              </SelectTrigger>
              <SelectContent>
                {bedsForPlot.map((bed) => (
                  <SelectItem key={bed.id} value={String(bed.id)}>
                    {bed.name ?? `Bed #${bed.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.bedId ? (
              <p className="text-xs text-destructive">{fieldErrors.bedId}</p>
            ) : null}
            {recentBeds.length ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Recents:</span>
                {recentBeds.map((id) => {
                  const bed = bedLookup.get(id);
                  if (!bed) return null;
                  return (
                    <Button
                      key={id}
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setPlotId(bed.plot_id ?? plotId ?? null);
                        setBedId(id);
                        setIsBulkMode(false);
                      }}
                    >
                      {bed.name ?? `Bed #${id}`}
                    </Button>
                  );
                })}
              </div>
            ) : null}
            {mode === 'direct' ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
                <div>
                  <p className="text-sm font-medium">Bulk to multiple beds</p>
                  <p className="text-xs text-muted-foreground">
                    Select multiple beds to create matching plantings.
                  </p>
                </div>
                <Switch
                  checked={isBulkMode}
                  onCheckedChange={(checked) => {
                    setIsBulkMode(Boolean(checked));
                    if (!checked && bedId) {
                      setBulkBeds([bedId]);
                    }
                  }}
                  aria-label="Toggle bulk bed selection"
                />
              </div>
            ) : null}
            {mode === 'direct' && isBulkMode ? (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">Select beds for this planting</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {bedsForPlot.map((bed) => (
                    <label key={bed.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={bulkBeds.includes(bed.id)}
                        onCheckedChange={(checked) =>
                          setBulkBeds((prev) =>
                            checked ? [...prev, bed.id] : prev.filter((id) => id !== bed.id)
                          )
                        }
                        aria-label={`Add ${bed.name ?? `Bed #${bed.id}`}`}
                      />
                      <span>{bed.name ?? `Bed #${bed.id}`}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {bulkBeds.length} bed{bulkBeds.length === 1 ? '' : 's'} selected
                </p>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handlePlotSheetOpenChange(true)}>
                <Layers className="h-4 w-4 mr-2" aria-hidden />
                Add plot
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBedSheetOpenChange(true)}>
                <MapPin className="h-4 w-4 mr-2" aria-hidden />
                Add bed
              </Button>
            </div>
          </div>
        );
      case 'nursery':
        return (
          <div className="space-y-3">
            <Label>Propagation method</Label>
            <div className="flex gap-2">
              <Button
                variant={mode === 'direct' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('direct')}
              >
                Direct to bed
              </Button>
              <Button
                variant={mode === 'nursery' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('nursery')}
              >
                Nursery sow
              </Button>
            </div>
            {mode === 'nursery' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Nursery</Label>
                  {prefDefaults?.nurseryId ? <Badge variant="outline">Default</Badge> : null}
                </div>
                <Select
                  value={nurseryId ?? ''}
                  onValueChange={(v) => {
                    clearFieldError('nurseryId');
                    setNurseryId(v || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a nursery" />
                  </SelectTrigger>
                  <SelectContent>
                    {nurseries.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.nurseryId ? (
                  <p className="text-xs text-destructive">{fieldErrors.nurseryId}</p>
                ) : null}
                {recentNurseries.length ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Recents:</span>
                    {recentNurseries.map((id) => {
                      const nursery = nurseries.find((n) => n.id === id);
                      if (!nursery) return null;
                      return (
                        <Button
                          key={id}
                          variant="secondary"
                          size="sm"
                          onClick={() => setNurseryId(nursery.id)}
                        >
                          {nursery.name}
                        </Button>
                      );
                    })}
                  </div>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNurserySheetOpenChange(true)}
                >
                  <Plus className="h-4 w-4 mr-2" aria-hidden />
                  Add nursery
                </Button>
              </div>
            ) : null}
          </div>
        );
      case 'variety':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>Crop variety</Label>
              {prefDefaults?.varietyId ? <Badge variant="outline">Default</Badge> : null}
            </div>
            <Select
              value={varietyId ? String(varietyId) : ''}
              onValueChange={(v) => {
                clearFieldError('varietyId');
                setVarietyId(Number(v));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a variety" />
              </SelectTrigger>
              <SelectContent>
                {cropVarieties.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.crops?.name ? `${v.crops.name} – ${v.name}` : v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.varietyId ? (
              <p className="text-xs text-destructive">{fieldErrors.varietyId}</p>
            ) : null}
            {recentVarieties.length ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Recents:</span>
                {recentVarieties.map((id) => {
                  const v = cropVarieties.find((cv) => cv.id === id);
                  if (!v) return null;
                  return (
                    <Button key={id} variant="secondary" size="sm" onClick={() => setVarietyId(id)}>
                      {v.crops?.name ? `${v.crops.name} – ${v.name}` : v.name}
                    </Button>
                  );
                })}
              </div>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => handleVarietySheetOpenChange(true)}>
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Add variety
            </Button>
          </div>
        );
      case 'schedule':
        return (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">Review summary</p>
                  <p className="text-xs text-muted-foreground">
                    Confirm details before creating this planting.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep('location')}>
                  Edit steps
                </Button>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Location / Plot</p>
                  <p className="font-medium">
                    {selectedLocation?.name ?? 'Location not set'} •{' '}
                    {selectedPlot?.name ?? 'Plot not set'}
                  </p>
                  <p className="text-muted-foreground">
                    {mode === 'nursery'
                      ? 'Propagation: Nursery sow'
                      : `Propagation: Direct to bed ${selectedBed?.name ?? bedId ?? 'Not set'}`}
                  </p>
                  {mode === 'nursery' ? (
                    <p className="text-muted-foreground">
                      Nursery: {selectedNursery?.name ?? 'Not set'}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Variety & schedule</p>
                  <p className="font-medium">
                    {selectedVariety
                      ? selectedVariety.crops?.name
                        ? `${selectedVariety.crops.name} – ${selectedVariety.name}`
                        : selectedVariety.name
                      : 'Variety not set'}
                  </p>
                  <p className="text-muted-foreground">
                    Qty: {qty || '—'} · Date: {date || '—'} · Weight(g): {weightGrams || '—'}
                  </p>
                  <p className="text-muted-foreground">Attachment: {attachment?.name ?? 'None'}</p>
                  {mode === 'direct' && isBulkMode ? (
                    <p className="text-muted-foreground">
                      Bulk selection: {bulkBeds.length} bed{bulkBeds.length === 1 ? '' : 's'}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Duplicate/conflict checks run on save; adjust date or location if warned.
              </p>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Templates</p>
                  <p className="text-xs text-muted-foreground">
                    Load defaults or save this setup as a reusable template.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={selectedTemplateId ?? ''}
                  onValueChange={(value) => {
                    setSelectedTemplateId(value);
                    handleApplyTemplate(value);
                  }}
                >
                  <SelectTrigger className="sm:w-72">
                    <SelectValue placeholder="Load template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templateList.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteTemplate}
                    disabled={!selectedTemplateId || isSavingTemplate}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="Template name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="sm:w-64"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSaveTemplate(false)}
                    disabled={isSavingTemplate}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSaveTemplate(true)}
                    disabled={isSavingTemplate}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Overwrite
                  </Button>
                </div>
              </div>
            </div>
            {bulkResult && (bulkResult.successes.length || bulkResult.failures.length) ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">{bulkResult.message}</p>
                {bulkResult.failures.length ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-muted-foreground">
                      Failed beds: {bulkResult.failures.map((f) => f.bedId).join(', ')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetryBulkFailures}
                      disabled={isSubmitting}
                    >
                      <Undo2 className="mr-2 h-4 w-4" />
                      Retry failed
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={qty}
                  onChange={(e) => {
                    clearFieldError('qty');
                    setQty(e.target.value);
                  }}
                />
                {fieldErrors.qty ? (
                  <p className="text-xs text-destructive">{fieldErrors.qty}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    clearFieldError('date');
                    setDate(e.target.value);
                  }}
                />
                {fieldErrors.date ? (
                  <p className="text-xs text-destructive">{fieldErrors.date}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>Weight (g) optional</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={weightGrams}
                  onChange={(e) => {
                    clearFieldError('weightGrams');
                    setWeightGrams(e.target.value);
                  }}
                />
                {fieldErrors.weightGrams ? (
                  <p className="text-xs text-destructive">{fieldErrors.weightGrams}</p>
                ) : null}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => {
                  clearFieldError('notes');
                  setNotes(e.target.value);
                }}
              />
              {fieldErrors.notes ? (
                <p className="text-xs text-destructive">{fieldErrors.notes}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Attachment (optional)</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) => {
                  clearFieldError('attachment');
                  setAttachment(e.target.files?.[0] ?? null);
                }}
              />
              <p className="text-xs text-muted-foreground">Max 5MB; jpeg/png/webp/avif.</p>
              {fieldErrors.attachment ? (
                <p className="text-xs text-destructive">{fieldErrors.attachment}</p>
              ) : null}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const isLastStep = step === 'schedule';
  const nextDisabled =
    (step === 'location' && !canContinueLocation) ||
    (step === 'plot' && !canContinuePlot) ||
    (step === 'nursery' && !canContinueNursery) ||
    (step === 'variety' && !canContinueVariety) ||
    isSubmitting;

  return (
    <div className="space-y-4">
      <FlowShell
        title="Guided planting"
        description="Select location, plot/bed or nursery, variety, and schedule in one flow."
        icon={<Leaf className="h-5 w-5" aria-hidden />}
        actions={
          !isMobile ? (
            <Button onClick={() => setStep('location')} size="sm">
              <Sprout className="h-4 w-4 mr-2" aria-hidden />
              Start planning
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {optionsError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {optionsError}. Some lists may be incomplete until reloaded.
            </div>
          ) : null}
          {(resumeMessage || hasDraft || saveError) && (
            <div className="flex flex-col gap-2 rounded-md border bg-muted/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-foreground">
                {resumeMessage ?? 'Draft will autosave as you edit.'}
                {saveError ? (
                  <span className="block text-destructive sm:inline sm:ml-2">{saveError}</span>
                ) : null}
                {!saveError && lastSavedAt ? (
                  <span className="block text-xs text-muted-foreground sm:inline sm:ml-2">
                    Autosaved at {lastSavedAt.toLocaleTimeString()}
                  </span>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleDiscardDraft}>
                  Discard draft
                </Button>
              </div>
            </div>
          )}
          <Stepper
            currentStepId={step}
            steps={stepperItems.map((s) => ({ id: s.id, title: s.label, description: s.label }))}
            onStepChange={(id) => setStep(id as WizardStep)}
          />
          <p className="text-xs text-muted-foreground">
            Steps above are clickable—tap any label to jump.
          </p>
          {renderStepContent()}
        </div>
      </FlowShell>

      {!locations.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Leaf className="size-10" />
            </EmptyMedia>
            <EmptyTitle>No locations yet</EmptyTitle>
            <EmptyDescription>Add a location to start planning plantings.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => handleLocationSheetOpenChange(true)}>
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Add location
            </Button>
          </EmptyContent>
        </Empty>
      ) : null}

      <StickyActionBar align="end" aria-label="Planting wizard actions" position="fixed">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {isLastStep ? 'Review and create planting' : 'Step through to schedule'}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={goPrev}
              disabled={step === 'location' || isSubmitting}
            >
              Back
            </Button>
            {!isLastStep ? (
              <Button onClick={goNext} disabled={nextDisabled}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Create planting'}
              </Button>
            )}
          </div>
        </div>
      </StickyActionBar>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm bulk creation</DialogTitle>
            <DialogDescription>
              Create {pendingBulk?.bedIds.length ?? 0} plantings for {pendingBulk?.event_date ?? ''}
              . Review targets before proceeding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">Beds</p>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {pendingBulk?.bedIds.map((id) => {
                const bed = bedLookup.get(id);
                return (
                  <li key={id} className="rounded-md border bg-muted/50 p-2">
                    {bed?.name ?? `Bed #${id}`}
                  </li>
                );
              })}
            </ul>
            <p className="text-sm text-muted-foreground">
              Variety ID: {pendingBulk?.crop_variety_id} · Qty: {pendingBulk?.qty}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingBulk) runBulkCreate(pendingBulk);
              }}
              disabled={!pendingBulk || isSubmitting}
            >
              {isSubmitting ? 'Creating…' : 'Create plantings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InlineCreateSheet
        open={locationSheetOpen}
        onOpenChange={handleLocationSheetOpenChange}
        title="Add location"
        description="Create a location to hold plots and beds."
        primaryAction={{ label: 'Save location', formId: 'locationFormWizard' }}
        secondaryAction={{ label: 'Cancel', onClick: () => handleLocationSheetOpenChange(false) }}
        side="right"
      >
        <LocationForm
          formId="locationFormWizard"
          closeDialog={() => handleLocationSheetOpenChange(false)}
          onCreated={handleLocationCreated}
        />
      </InlineCreateSheet>

      <InlineCreateSheet
        open={plotSheetOpen}
        onOpenChange={handlePlotSheetOpenChange}
        title="Add plot"
        description="Create a plot within a location."
        primaryAction={{ label: 'Save plot', formId: 'plotFormWizard' }}
        secondaryAction={{ label: 'Cancel', onClick: () => handlePlotSheetOpenChange(false) }}
        side="right"
      >
        <PlotForm
          formId="plotFormWizard"
          closeDialog={() => handlePlotSheetOpenChange(false)}
          locations={locationRecords}
          defaultLocationId={locationId ?? undefined}
          onCreated={handlePlotCreated}
        />
      </InlineCreateSheet>

      <InlineCreateSheet
        open={bedSheetOpen}
        onOpenChange={handleBedSheetOpenChange}
        title="Add bed"
        description="Create a bed inside a plot."
        primaryAction={{ label: 'Save bed', formId: 'bedFormWizard' }}
        secondaryAction={{ label: 'Cancel', onClick: () => handleBedSheetOpenChange(false) }}
        side="right"
      >
        <BedForm
          formId="bedFormWizard"
          closeDialog={() => handleBedSheetOpenChange(false)}
          plots={plotRecordsForBedForm}
          initialPlotId={plotId}
          onCreated={handleBedCreated}
        />
      </InlineCreateSheet>

      <InlineCreateSheet
        open={nurserySheetOpen}
        onOpenChange={handleNurserySheetOpenChange}
        title="Add nursery"
        description="Create a nursery for sowing."
        primaryAction={{ label: 'Save nursery', formId: 'nurseryFormWizard' }}
        secondaryAction={{ label: 'Cancel', onClick: () => handleNurserySheetOpenChange(false) }}
        side="right"
      >
        <form id="nurseryFormWizard" className="space-y-3" action={nurseryCreateAction} noValidate>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input name="name" required />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select name="location_id" defaultValue={locationId ?? locations[0]?.id ?? ''}>
              <SelectTrigger>
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
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea name="notes" rows={3} />
          </div>
          {!nurseryCreateState.ok && nurseryCreateState.fieldErrors?.name ? (
            <p className="text-sm text-destructive">{nurseryCreateState.fieldErrors.name[0]}</p>
          ) : null}
        </form>
      </InlineCreateSheet>

      <InlineCreateSheet
        open={varietySheetOpen}
        onOpenChange={handleVarietySheetOpenChange}
        title="Add crop variety"
        description="Create a new variety and return to the flow."
        primaryAction={{ label: 'Save variety', formId: 'varietyFormWizard' }}
        secondaryAction={{ label: 'Cancel', onClick: () => handleVarietySheetOpenChange(false) }}
        side="right"
      >
        <CropVarietyForm
          formId="varietyFormWizard"
          closeDialog={() => handleVarietySheetOpenChange(false)}
          crops={creationContext?.crops ?? []}
          onCreated={(variety) => {
            setVarietyId(variety.id);
            handleVarietySheetOpenChange(false);
            router.refresh();
          }}
        />
      </InlineCreateSheet>
    </div>
  );
}
