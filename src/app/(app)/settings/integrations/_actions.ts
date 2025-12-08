'use server';

import { revalidateTag } from 'next/cache';
import { getUserAndProfile } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/authz';
import {
  setOpenWeatherIntegration,
  testOpenWeatherApiKey,
  getOpenWeatherIntegration,
} from '@/lib/integrations';
import { testGoogleCalendar, insertCalendarEvent } from '@/lib/google-calendar';
import type { Json } from '@/lib/database.types';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type SaveOpenWeatherState = { message: string; ok?: boolean };
export type GoogleCalendarIntegrationSettings = {
  enabled: boolean;
  calendarId: string | null;
  hasServiceAccount: boolean;
};

type GoogleCalendarSettingsRecord = {
  calendar_id?: string;
  secrets?: Record<string, unknown>;
} | null;

type JsonObject = { [key: string]: Json };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDefaultSecret(
  raw: unknown
): { ciphertextB64?: string; ivB64?: string; tagB64?: string } | undefined {
  if (!isRecord(raw)) return undefined;
  const { ciphertextB64, ivB64, tagB64 } = raw;
  return {
    ciphertextB64: typeof ciphertextB64 === 'string' ? ciphertextB64 : undefined,
    ivB64: typeof ivB64 === 'string' ? ivB64 : undefined,
    tagB64: typeof tagB64 === 'string' ? tagB64 : undefined,
  };
}

function parseGoogleCalendarSettings(raw: unknown): GoogleCalendarSettingsRecord {
  if (!isRecord(raw)) return null;
  const calendar_id = typeof raw.calendar_id === 'string' ? raw.calendar_id : undefined;
  const secrets = isRecord(raw.secrets) ? raw.secrets : undefined;
  return {
    calendar_id,
    secrets,
  };
}

function buildGoogleCalendarSettings(calendarId: string | null): JsonObject | null {
  const trimmed = calendarId?.trim();
  if (!trimmed) return null;
  return { calendar_id: trimmed };
}

export async function getIntegrationsPageData(): Promise<{
  openWeather: { enabled: boolean; hasKey: boolean };
  googleCalendar: GoogleCalendarIntegrationSettings;
  error?: string;
}> {
  const integration = await getOpenWeatherIntegration();
  const admin = createSupabaseAdminClient();
  const { data: gcalData, error: gcalError } = await admin
    .from('external_integrations')
    .select('enabled, settings')
    .eq('service', 'google_calendar')
    .maybeSingle();

  const gSettings = parseGoogleCalendarSettings(gcalData?.settings);
  const defaultSecret = parseDefaultSecret(gSettings?.secrets?.['default']);
  const hasServiceAccount = Boolean(
    defaultSecret?.ciphertextB64 && defaultSecret?.ivB64 && defaultSecret?.tagB64
  );

  return {
    openWeather: { enabled: integration.enabled, hasKey: Boolean(integration.apiKey) },
    googleCalendar: {
      enabled: Boolean(gcalData?.enabled),
      calendarId: gSettings?.calendar_id ?? null,
      hasServiceAccount,
    },
    error: gcalError ? `Database Error: ${gcalError.message}` : undefined,
  };
}

function getBool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  if (v == null) return false;
  const s = String(v).toLowerCase();
  return s === 'on' || s === 'true' || s === '1';
}

async function getFormDataText(formData: FormData, key: string): Promise<string> {
  const value = formData.get(key);
  if (typeof value === 'string') return value;
  if (value instanceof File) return await value.text();
  return '';
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
  const apiKey = (await getFormDataText(formData, 'apiKey')).trim();
  try {
    await setOpenWeatherIntegration({
      enabled,
      apiKey: apiKey ? apiKey : undefined,
      updatedBy: user.id,
    });
    revalidateTag('integration-openweather');
    return { message: 'Settings saved', ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { message: msg, ok: false };
  }
}

export async function testOpenWeatherKeyAction(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { ok: false, message: 'Unauthorized' };
  }
  const apiKey = (await getFormDataText(formData, 'apiKey')).trim();
  const keyToTest = apiKey || undefined;
  const result = await testOpenWeatherApiKey(keyToTest);
  return {
    ok: result.ok,
    message: result.ok ? 'API key is valid' : `Test failed: ${result.message}`,
  };
}

// Convenience server actions for HTML form action types (void-returning)
export async function saveOpenWeatherSettingsDirect(formData: FormData): Promise<void> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return;
  }
  const enabledRaw = formData.get('enabled');
  const enabled =
    typeof enabledRaw === 'string'
      ? ['on', 'true', '1'].includes(enabledRaw.toLowerCase())
      : Boolean(enabledRaw);
  const apiKey = (await getFormDataText(formData, 'apiKey')).trim();
  await setOpenWeatherIntegration({
    enabled,
    apiKey: apiKey ? apiKey : undefined,
    updatedBy: user.id,
  });
  revalidateTag('integration-openweather');
}

export async function testOpenWeatherKeyActionDirect(formData: FormData): Promise<void> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) return;
  const apiKey = (await getFormDataText(formData, 'apiKey')).trim();
  const keyToTest = apiKey || undefined;
  await testOpenWeatherApiKey(keyToTest);
}

export async function revealOpenWeatherKeyAction(): Promise<{
  ok: boolean;
  apiKey?: string;
  message?: string;
}> {
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
  const enabled =
    typeof enabledRaw === 'string'
      ? ['on', 'true', '1'].includes(enabledRaw.toLowerCase())
      : Boolean(enabledRaw);
  const calendarId = (await getFormDataText(formData, 'calendarId')).trim();
  const serviceAccountJson = (await getFormDataText(formData, 'serviceAccountJson')).trim();

  const admin = (await import('@/lib/supabase-admin')).createSupabaseAdminClient();
  const baseSettings = buildGoogleCalendarSettings(calendarId);
  const payload: {
    service: 'google_calendar';
    enabled: boolean;
    updated_by: string;
    settings: Json | null;
  } = {
    service: 'google_calendar',
    enabled,
    updated_by: user.id,
    settings: baseSettings,
  };
  if (serviceAccountJson) {
    const { getDataEncryptionKey, encryptSecret } = await import('@/lib/crypto');
    const key = getDataEncryptionKey();
    const { ciphertextB64, ivB64, tagB64 } = encryptSecret(serviceAccountJson, key);
    const secrets: Record<string, Json> = { default: { ciphertextB64, ivB64, tagB64 } };
    const base: JsonObject = baseSettings ?? {};
    const merged: JsonObject = { ...base, secrets };
    payload.settings = merged;
  }
  // Upsert by service
  const { data: existing } = await admin
    .from('external_integrations')
    .select('id')
    .eq('service', 'google_calendar')
    .maybeSingle();
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

export async function testGoogleCalendarAction(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) return { ok: false, message: 'Unauthorized' };
  const calendarId = (await getFormDataText(formData, 'calendarId')).trim();
  const serviceAccountJson = (await getFormDataText(formData, 'serviceAccountJson')).trim();
  const res = await testGoogleCalendar({
    calendarId: calendarId || undefined,
    serviceAccountJson: serviceAccountJson || undefined,
  });
  return res;
}

export async function createTestEventAction(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) return { ok: false, message: 'Unauthorized' };

  const title = (await getFormDataText(formData, 'title')).trim() || 'Test Event';
  const date = (await getFormDataText(formData, 'date')).trim();
  const description = (await getFormDataText(formData, 'description')).trim();
  const location = (await getFormDataText(formData, 'location')).trim();
  const isAllDay = getBool(formData, 'allDay');
  const startTime = (await getFormDataText(formData, 'startTime')).trim();
  const endDate = (await getFormDataText(formData, 'endDate')).trim() || date;
  const endTime = (await getFormDataText(formData, 'endTime')).trim();
  const timezone = (await getFormDataText(formData, 'timezone')).trim() || 'America/Los_Angeles';
  const colorId = (await getFormDataText(formData, 'colorId')).trim();

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
    const endDateTime = endTime
      ? `${endDate}T${endTime}:00`
      : `${date}T${(parseInt(startTime.split(':')[0]) + 1).toString().padStart(2, '0')}:${startTime.split(':')[1]}:00`;

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
