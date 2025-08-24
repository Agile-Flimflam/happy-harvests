'use server';

import { revalidateTag } from 'next/cache';
import { getUserAndProfile } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/authz';
import { setOpenWeatherIntegration, testOpenWeatherApiKey, getOpenWeatherIntegration } from '@/lib/integrations';
import { testGoogleCalendar, insertCalendarEvent } from '@/lib/google-calendar';
import type { Json } from '@/lib/database.types';

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

export async function saveGoogleCalendarSettingsDirect(formData: FormData): Promise<void> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) return;
  // Persist into external_integrations with service = 'google_calendar'
  // We will reuse supabase admin client here to avoid adding a new file; keep logic inline
  const enabledRaw = formData.get('enabled');
  const enabled = typeof enabledRaw === 'string' ? ['on', 'true', '1'].includes(enabledRaw.toLowerCase()) : Boolean(enabledRaw);
  const calendarId = (formData.get('calendarId') ?? '') as string;
  const serviceAccountJson = (formData.get('serviceAccountJson') ?? '') as string;

  const admin = (await import('@/lib/supabase-admin')).createSupabaseAdminClient();
  const payload: {
    service: 'google_calendar';
    enabled: boolean;
    updated_by: string;
    settings: Json | null;
  } = {
    service: 'google_calendar',
    enabled,
    updated_by: user.id,
    settings: calendarId ? ({ calendar_id: calendarId } as unknown as Json) : null,
  };
  if (serviceAccountJson) {
    const { getDataEncryptionKey, encryptSecret } = await import('@/lib/crypto');
    const key = getDataEncryptionKey();
    const { ciphertextB64, ivB64, tagB64 } = encryptSecret(serviceAccountJson, key);
    const secrets: Record<string, Json> = { default: { ciphertextB64, ivB64, tagB64 } };
    const base: Record<string, Json> = payload.settings ? ((payload.settings as unknown) as Record<string, Json>) : {};
    const merged: Record<string, Json> = { ...base, secrets };
    payload.settings = merged as unknown as Json;
  }
  // Upsert by service
  const { data: existing } = await admin.from('external_integrations').select('id').eq('service', 'google_calendar').maybeSingle();
  if (existing) {
    const updates: {
      enabled: boolean;
      updated_by: string;
      settings?: Json | null;
    } = {
      enabled: payload.enabled,
      updated_by: payload.updated_by,
      settings: payload.settings ?? undefined,
    };
    await admin.from('external_integrations').update(updates).eq('service', 'google_calendar');
  } else {
    await admin.from('external_integrations').insert(payload);
  }
  revalidateTag('integration-google-calendar');
}

export async function testGoogleCalendarAction(formData: FormData): Promise<{ ok: boolean; message: string }>{
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) return { ok: false, message: 'Unauthorized' };
  const calendarId = (formData.get('calendarId') ?? '') as string;
  const serviceAccountJson = (formData.get('serviceAccountJson') ?? '') as string;
  const res = await testGoogleCalendar({ calendarId: calendarId || undefined, serviceAccountJson: serviceAccountJson || undefined });
  return res;
}

export async function createTestEventAction(formData: FormData): Promise<{ ok: boolean; message: string }>{
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) return { ok: false, message: 'Unauthorized' };
  
  const title = (formData.get('title') ?? 'Test Event') as string;
  const date = (formData.get('date') ?? '') as string;
  const description = (formData.get('description') ?? '') as string;
  const location = (formData.get('location') ?? '') as string;
  const isAllDay = formData.get('allDay') === 'on';
  const startTime = (formData.get('startTime') ?? '') as string;
  const endDate = (formData.get('endDate') ?? date) as string;
  const endTime = (formData.get('endTime') ?? '') as string;
  const timezone = (formData.get('timezone') ?? 'America/Los_Angeles') as string;
  const colorId = (formData.get('colorId') ?? '') as string;
  
  if (!date) return { ok: false, message: 'Date is required' };
  
  const event: import('googleapis').calendar_v3.Schema$Event = {
    summary: title,
    description: description || undefined,
    location: location || undefined,
    colorId: colorId || undefined,
  };

  if (isAllDay) {
    // All-day event
    const startDate = new Date(date + 'T00:00:00.000Z');
    const nextDay = new Date(startDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    
    event.start = { date: date };
    event.end = { date: nextDay.toISOString().slice(0, 10) };
  } else {
    // Timed event
    if (!startTime) return { ok: false, message: 'Start time is required for timed events' };
    
    const startDateTime = `${date}T${startTime}:00`;
    const endDateTime = endTime ? `${endDate}T${endTime}:00` : `${date}T${(parseInt(startTime.split(':')[0]) + 1).toString().padStart(2, '0')}:${startTime.split(':')[1]}:00`;
    
    event.start = { dateTime: startDateTime, timeZone: timezone };
    event.end = { dateTime: endDateTime, timeZone: timezone };
  }
  
  const result = await insertCalendarEvent(event);
  if (result.ok) {
    return { ok: true, message: 'Test event created successfully' };
  } else {
    return { ok: false, message: result.message || 'Failed to create test event' };
  }
}
