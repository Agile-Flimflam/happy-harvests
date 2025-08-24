'use server';

import { revalidateTag } from 'next/cache';
import { getUserAndProfile } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/authz';
import { setOpenWeatherIntegration, testOpenWeatherApiKey, getOpenWeatherIntegration } from '@/lib/integrations';

export type SaveOpenWeatherState = { message: string; ok?: boolean };

function getBool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  if (v == null) return false;
  const s = String(v).toLowerCase();
  return s === 'on' || s === 'true' || s === '1';
}

export async function saveOpenWeatherSettings(
  _prev: SaveOpenWeatherState,
  formData: FormData
): Promise<SaveOpenWeatherState> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { message: 'Unauthorized', ok: false };
  }
  const enabled = getBool(formData, 'enabled');
  const apiKey = (formData.get('apiKey') ?? '') as string;
  try {
    await setOpenWeatherIntegration({ enabled, apiKey: apiKey ? apiKey : undefined, updatedBy: user.id });
    revalidateTag('integration-openweather');
    return { message: 'Settings saved', ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { message: msg, ok: false };
  }
}

export async function testOpenWeatherKeyAction(formData: FormData): Promise<{ ok: boolean; message: string }>{
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { ok: false, message: 'Unauthorized' };
  }
  const apiKey = (formData.get('apiKey') ?? '') as string;
  const keyToTest = apiKey || undefined;
  const result = await testOpenWeatherApiKey(keyToTest);
  return { ok: result.ok, message: result.ok ? 'API key is valid' : `Test failed: ${result.message}` };
}

// Convenience server actions for HTML form action types (void-returning)
export async function saveOpenWeatherSettingsDirect(formData: FormData): Promise<void> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return;
  }
  const enabledRaw = formData.get('enabled');
  const enabled = typeof enabledRaw === 'string' ? ['on', 'true', '1'].includes(enabledRaw.toLowerCase()) : Boolean(enabledRaw);
  const apiKey = (formData.get('apiKey') ?? '') as string;
  await setOpenWeatherIntegration({ enabled, apiKey: apiKey ? apiKey : undefined, updatedBy: user.id });
  revalidateTag('integration-openweather');
}

export async function testOpenWeatherKeyActionDirect(formData: FormData): Promise<void> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) return;
  const apiKey = (formData.get('apiKey') ?? '') as string;
  const keyToTest = apiKey || undefined;
  await testOpenWeatherApiKey(keyToTest);
}

export async function revealOpenWeatherKeyAction(): Promise<{ ok: boolean; apiKey?: string; message?: string }>{
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { ok: false, message: 'Unauthorized' };
  }
  try {
    const integration = await getOpenWeatherIntegration();
    if (!integration.apiKey) return { ok: false, message: 'No saved key' };
    return { ok: true, apiKey: integration.apiKey };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, message: msg };
  }
}
