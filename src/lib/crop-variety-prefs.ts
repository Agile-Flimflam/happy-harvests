import { createSupabaseServerClient } from './supabase-server';

const PREF_KEY = 'cropVarietyPrefs';
const RECENT_LIMIT = 5;

export type CropVarietyDefaults = {
  cropId?: number;
  isOrganic?: boolean;
};

export type CropVarietyPrefs = {
  recentCropIds: number[];
  favoriteCropIds: number[];
  lastDefaults?: CropVarietyDefaults;
  updatedAt?: string;
};

type PrefsResult = { ok: true; prefs: CropVarietyPrefs } | { ok: false; error: string };

function uniqueIds(ids: number[], limit: number): number[] {
  const seen = new Set<number>();
  const next: number[] = [];
  for (const id of ids) {
    if (!Number.isFinite(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
    if (next.length >= limit) break;
  }
  return next;
}

async function writePrefs(next: CropVarietyPrefs): Promise<PrefsResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    data: { [PREF_KEY]: next },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, prefs: next };
}

export async function getCropVarietyPrefs(): Promise<CropVarietyPrefs | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const raw = user.user_metadata?.[PREF_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const prefs = raw as CropVarietyPrefs;
  return {
    recentCropIds: prefs.recentCropIds ?? [],
    favoriteCropIds: prefs.favoriteCropIds ?? [],
    lastDefaults: prefs.lastDefaults,
    updatedAt: prefs.updatedAt,
  };
}

export async function pushRecentCrop(
  cropId: number,
  defaults?: CropVarietyDefaults
): Promise<PrefsResult> {
  if (!Number.isFinite(cropId) || cropId <= 0) {
    return { ok: false, error: 'Invalid crop id' };
  }
  const existing = (await getCropVarietyPrefs()) ?? { recentCropIds: [], favoriteCropIds: [] };
  const mergedRecent = uniqueIds([cropId, ...(existing.recentCropIds ?? [])], RECENT_LIMIT);
  const next: CropVarietyPrefs = {
    ...existing,
    recentCropIds: mergedRecent,
    lastDefaults: defaults ?? existing.lastDefaults,
    updatedAt: new Date().toISOString(),
  };
  return writePrefs(next);
}

export async function rememberVarietyDefaults(defaults: CropVarietyDefaults): Promise<PrefsResult> {
  const existing = (await getCropVarietyPrefs()) ?? { recentCropIds: [], favoriteCropIds: [] };
  const next: CropVarietyPrefs = {
    ...existing,
    lastDefaults: {
      ...existing.lastDefaults,
      ...defaults,
    },
    updatedAt: new Date().toISOString(),
  };
  return writePrefs(next);
}

export async function toggleFavoriteCropPref(cropId: number): Promise<PrefsResult> {
  if (!Number.isFinite(cropId) || cropId <= 0) {
    return { ok: false, error: 'Invalid crop id' };
  }
  const existing = (await getCropVarietyPrefs()) ?? { recentCropIds: [], favoriteCropIds: [] };
  const currentFavorites = existing.favoriteCropIds ?? [];
  const isFavorite = currentFavorites.includes(cropId);
  const nextFavorites = isFavorite
    ? currentFavorites.filter((id) => id !== cropId)
    : uniqueIds([cropId, ...currentFavorites], RECENT_LIMIT);
  const next: CropVarietyPrefs = {
    ...existing,
    favoriteCropIds: nextFavorites,
    updatedAt: new Date().toISOString(),
  };
  return writePrefs(next);
}
