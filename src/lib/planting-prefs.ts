import { createSupabaseServerClient } from './supabase-server';

const PREF_KEY = 'plantingPrefs';
const RECENT_LIMIT = 6;
const TEMPLATE_LIMIT = 15;

export type PlantingDefaults = {
  locationId?: string | null;
  plotId?: number | null;
  bedId?: number | null;
  nurseryId?: string | null;
  varietyId?: number | null;
  mode?: 'direct' | 'nursery';
  qty?: number | null;
  weightGrams?: number | null;
  date?: string | null;
  notes?: string | null;
};

export type PlantingTemplate = {
  id: string;
  name: string;
  payload: PlantingDefaults;
  createdAt: string;
  updatedAt: string;
};

export type PlantingPrefs = {
  recents: {
    bedIds: number[];
    plotIds: number[];
    nurseryIds: string[];
    varietyIds: number[];
  };
  defaults?: PlantingDefaults;
  templates: PlantingTemplate[];
  updatedAt?: string;
};

type PrefsResult = { ok: true; prefs: PlantingPrefs } | { ok: false; error: string };

const uniqueIds = <T extends string | number>(ids: T[], limit: number): T[] => {
  const seen = new Set<T>();
  const deduped: T[] = [];
  for (const id of ids) {
    if (id === null || id === undefined) continue;
    if (typeof id !== 'string' && typeof id !== 'number') continue;
    if (seen.has(id)) continue;
    seen.add(id);
    deduped.push(id);
    if (deduped.length >= limit) break;
  }
  return deduped;
};

const readPrefs = async (): Promise<PlantingPrefs | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const raw = user.user_metadata?.[PREF_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const prefs = raw as PlantingPrefs;
  return {
    recents: {
      bedIds: prefs.recents?.bedIds ?? [],
      plotIds: prefs.recents?.plotIds ?? [],
      nurseryIds: prefs.recents?.nurseryIds ?? [],
      varietyIds: prefs.recents?.varietyIds ?? [],
    },
    defaults: prefs.defaults,
    templates: prefs.templates ?? [],
    updatedAt: prefs.updatedAt,
  };
};

async function writePrefs(next: PlantingPrefs): Promise<PrefsResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    data: { [PREF_KEY]: next },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, prefs: next };
}

export async function getPlantingPrefs(): Promise<PlantingPrefs | null> {
  return readPrefs();
}

type PushRecentsInput = {
  bedId?: number | null;
  plotId?: number | null;
  nurseryId?: string | null;
  varietyId?: number | null;
  defaults?: PlantingDefaults;
};

export async function pushPlantingRecents(input: PushRecentsInput): Promise<PrefsResult> {
  const existing = (await readPrefs()) ?? {
    recents: { bedIds: [], plotIds: [], nurseryIds: [], varietyIds: [] },
    templates: [],
  };
  const recents = existing.recents ?? { bedIds: [], plotIds: [], nurseryIds: [], varietyIds: [] };
  const merged: PlantingPrefs = {
    ...existing,
    recents: {
      bedIds:
        input.bedId != null
          ? uniqueIds([input.bedId, ...(recents.bedIds ?? [])], RECENT_LIMIT)
          : (recents.bedIds ?? []),
      plotIds:
        input.plotId != null
          ? uniqueIds([input.plotId, ...(recents.plotIds ?? [])], RECENT_LIMIT)
          : (recents.plotIds ?? []),
      nurseryIds:
        input.nurseryId != null
          ? uniqueIds([input.nurseryId, ...(recents.nurseryIds ?? [])], RECENT_LIMIT)
          : (recents.nurseryIds ?? []),
      varietyIds:
        input.varietyId != null
          ? uniqueIds([input.varietyId, ...(recents.varietyIds ?? [])], RECENT_LIMIT)
          : (recents.varietyIds ?? []),
    },
    defaults: input.defaults
      ? {
          ...existing.defaults,
          ...input.defaults,
        }
      : existing.defaults,
    updatedAt: new Date().toISOString(),
  };
  return writePrefs(merged);
}

export async function rememberPlantingDefaults(defaults: PlantingDefaults): Promise<PrefsResult> {
  const existing = (await readPrefs()) ?? {
    recents: { bedIds: [], plotIds: [], nurseryIds: [], varietyIds: [] },
    templates: [],
  };
  const next: PlantingPrefs = {
    ...existing,
    defaults: {
      ...existing.defaults,
      ...defaults,
    },
    updatedAt: new Date().toISOString(),
  };
  return writePrefs(next);
}

type TemplateSaveInput = {
  id?: string;
  name: string;
  payload: PlantingDefaults;
  overwrite?: boolean;
};

export async function savePlantingTemplate(input: TemplateSaveInput): Promise<PrefsResult> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    return { ok: false, error: 'Template name is required.' };
  }
  const existing = (await readPrefs()) ?? {
    recents: { bedIds: [], plotIds: [], nurseryIds: [], varietyIds: [] },
    templates: [],
  };
  const templates = existing.templates ?? [];
  const now = new Date().toISOString();
  const existingByName = templates.find(
    (t) => t.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase()
  );
  const templateId =
    input.id ??
    existingByName?.id ??
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `tpl_${Date.now()}`);
  if (existingByName && !input.overwrite && !input.id) {
    return {
      ok: false,
      error: 'A template with this name already exists. Use overwrite to update it.',
    };
  }
  const withoutId = templates.filter((t) => t.id !== templateId);
  const nextTemplate: PlantingTemplate = {
    id: templateId,
    name: trimmedName,
    payload: input.payload,
    createdAt: existingByName?.createdAt ?? now,
    updatedAt: now,
  };
  const nextTemplates = [nextTemplate, ...withoutId].slice(0, TEMPLATE_LIMIT);
  const next: PlantingPrefs = {
    ...existing,
    templates: nextTemplates,
    updatedAt: now,
  };
  return writePrefs(next);
}

export async function deletePlantingTemplate(templateId: string): Promise<PrefsResult> {
  const existing = (await readPrefs()) ?? {
    recents: { bedIds: [], plotIds: [], nurseryIds: [], varietyIds: [] },
    templates: [],
  };
  const nextTemplates = (existing.templates ?? []).filter((t) => t.id !== templateId);
  const next: PlantingPrefs = {
    ...existing,
    templates: nextTemplates,
    updatedAt: new Date().toISOString(),
  };
  return writePrefs(next);
}
