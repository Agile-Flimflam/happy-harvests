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

function logDbErrorAndRedact(context: string, err: unknown): string {
  console.error(`[Integrations] ${context}`, err);
  return 'Database error. Please try again.';
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
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return {
      openWeather: { enabled: false, hasKey: false },
      googleCalendar: { enabled: false, calendarId: null, hasServiceAccount: false },
      error: 'Unauthorized',
    };
  }
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
    error: gcalError ? logDbErrorAndRedact('google_calendar fetch failed', gcalError) : undefined,
  };
}

function getBool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  if (v == null) return false;
  const s = String(v).toLowerCase();
  return s === 'on' || s === 'true' || s === '1';
}

const isValidDateYMD = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [yStr, mStr, dStr] = value.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    Number.isFinite(utc.getTime()) &&
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
};

const isValidTimeHM = (value: string): boolean => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
};

const pad2 = (value: number): string => value.toString().padStart(2, '0');

async function getFormDataText(
  formData: FormData,
  key: string,
  options?: { allowFile?: boolean; fieldLabel?: string }
): Promise<string> {
  const { allowFile = false, fieldLabel } = options ?? {};
  const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB guard to avoid large in-memory reads
  const value = formData.get(key);

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof File) {
    if (!allowFile) {
      throw new Error(`${fieldLabel ?? key} must be provided as text`);
    }
    if (typeof value.size === 'number' && value.size > MAX_FILE_BYTES) {
      throw new Error(`${fieldLabel ?? key} file is too large (max 5MB)`);
    }
    return await value.text();
  }

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
  const apiKey = (
    await getFormDataText(formData, 'apiKey', { allowFile: false, fieldLabel: 'API key' })
  ).trim();
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
  const apiKey = (
    await getFormDataText(formData, 'apiKey', { allowFile: false, fieldLabel: 'API key' })
  ).trim();
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
  const enabled = getBool(formData, 'enabled');
  const apiKey = (
    await getFormDataText(formData, 'apiKey', { allowFile: false, fieldLabel: 'API key' })
  ).trim();
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
  const apiKey = (
    await getFormDataText(formData, 'apiKey', { allowFile: false, fieldLabel: 'API key' })
  ).trim();
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
  const enabled = getBool(formData, 'enabled');
  const calendarId = (await getFormDataText(formData, 'calendarId')).trim();
  const serviceAccountJson = (
    await getFormDataText(formData, 'serviceAccountJson', {
      allowFile: false,
      fieldLabel: 'Service account JSON',
    })
  ).trim();

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
      settings: payload.settings,
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
  const serviceAccountJson = (
    await getFormDataText(formData, 'serviceAccountJson', {
      allowFile: false,
      fieldLabel: 'Service account JSON',
    })
  ).trim();
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
  if (!isValidDateYMD(date)) return { ok: false, message: 'Date must be in YYYY-MM-DD format' };

  const event: import('googleapis').calendar_v3.Schema$Event = {
    summary: title,
    description: description || undefined,
    location: location || undefined,
    colorId: colorId || undefined,
  };

  if (isAllDay) {
    // All-day event
    const startDate = new Date(date + 'T00:00:00.000Z');
    if (!Number.isFinite(startDate.getTime())) {
      return { ok: false, message: 'Invalid start date' };
    }
    const nextDay = new Date(startDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    event.start = { date: date };
    event.end = { date: nextDay.toISOString().slice(0, 10) };
  } else {
    // Timed event
    if (!startTime) return { ok: false, message: 'Start time is required for timed events' };
    if (!isValidTimeHM(startTime)) {
      return { ok: false, message: 'Start time must be in HH:MM (24h) format' };
    }
    if (!isValidDateYMD(endDate)) {
      return { ok: false, message: 'End date must be in YYYY-MM-DD format' };
    }
    if (endTime && !isValidTimeHM(endTime)) {
      return { ok: false, message: 'End time must be in HH:MM (24h) format' };
    }

    const startDateObj = new Date(`${date}T${startTime}:00`);
    if (!Number.isFinite(startDateObj.getTime())) {
      return { ok: false, message: 'Invalid start date/time' };
    }

    let endDateTime: string;
    if (endTime) {
      const endDateObj = new Date(`${endDate}T${endTime}:00`);
      if (!Number.isFinite(endDateObj.getTime())) {
        return { ok: false, message: 'Invalid end date/time' };
      }
      endDateTime = `${endDate}T${endTime}:00`;
    } else {
      // Note: this simple +1h UTC math does not account for DST transitions.
      // For production recurrence/duration handling consider a TZ-aware library.
      const endDateObj = new Date(startDateObj.getTime() + 60 * 60 * 1000);
      if (!Number.isFinite(endDateObj.getTime())) {
        return { ok: false, message: 'Invalid end date/time' };
      }
      const computedDate = `${endDateObj.getFullYear()}-${pad2(endDateObj.getMonth() + 1)}-${pad2(
        endDateObj.getDate()
      )}`;
      const computedTime = `${pad2(endDateObj.getHours())}:${pad2(endDateObj.getMinutes())}`;
      endDateTime = `${computedDate}T${computedTime}:00`;
    }

    const startDateTime = `${date}T${startTime}:00`;

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
