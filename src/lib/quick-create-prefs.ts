import { createSupabaseServerClient } from './supabase-server';

export type BedSizePreference = {
  lengthInches: number;
  widthInches: number;
};

export type QuickCreatePrefs = {
  lastLocationId?: string;
  lastPlotId?: number;
  commonBedSize?: BedSizePreference;
  updatedAt?: string;
};

type PrefsResult = { ok: true; prefs: QuickCreatePrefs | null } | { ok: false; error: string };

const PREFERENCE_KEY = 'quickCreate';

export async function getQuickCreatePrefs(): Promise<QuickCreatePrefs | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  const raw = user.user_metadata?.[PREFERENCE_KEY];
  if (raw && typeof raw === 'object') {
    return raw as QuickCreatePrefs;
  }
  return null;
}

async function writePrefs(next: QuickCreatePrefs): Promise<PrefsResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    data: { [PREFERENCE_KEY]: next },
  });
  if (error) {
    console.error('[QuickCreatePrefs] Failed to persist', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, prefs: next };
}

export async function saveQuickCreatePrefs(
  partial: Partial<QuickCreatePrefs>
): Promise<PrefsResult> {
  const existing = (await getQuickCreatePrefs()) ?? {};
  const merged: QuickCreatePrefs = {
    ...existing,
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  return writePrefs(merged);
}

export async function rememberLastLocation(locationId: string): Promise<void> {
  if (!locationId) return;
  await saveQuickCreatePrefs({ lastLocationId: locationId });
}

export async function rememberLastPlot(plotId: number): Promise<void> {
  if (!Number.isFinite(plotId)) return;
  await saveQuickCreatePrefs({ lastPlotId: plotId });
}

export async function rememberBedSize(size: BedSizePreference): Promise<void> {
  if (!size || !Number.isFinite(size.lengthInches) || !Number.isFinite(size.widthInches)) {
    return;
  }
  await saveQuickCreatePrefs({ commonBedSize: size });
}
