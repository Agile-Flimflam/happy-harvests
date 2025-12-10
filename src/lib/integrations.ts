import 'server-only';

import { revalidateTag } from 'next/cache';
import { createSupabaseAdminClient } from './supabase-admin';
import { decryptSecret, encryptSecret, getDataEncryptionKey } from './crypto';
import type { Tables } from './supabase-server';
import type { Database, Json } from './database.types';

type OpenWeatherIntegration = {
  enabled: boolean;
  apiKey: string | null;
};

type SecretPayload = {
  ciphertextB64: string;
  ivB64: string;
  tagB64: string;
};

const INTEGRATION_TAG = 'integration-openweather';

type JsonObject = Record<string, Json>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is Json {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

function toJsonObject(raw: unknown): JsonObject | null {
  if (!isRecord(raw)) return null;
  const obj: JsonObject = {};
  for (const [k, v] of Object.entries(raw)) {
    if (isJsonValue(v)) {
      obj[k] = v;
    }
  }
  return obj;
}

function parseSecret(raw: unknown): SecretPayload | null {
  if (!isRecord(raw)) return null;
  const { ciphertextB64, ivB64, tagB64 } = raw;
  return typeof ciphertextB64 === 'string' &&
    typeof ivB64 === 'string' &&
    typeof tagB64 === 'string'
    ? { ciphertextB64, ivB64, tagB64 }
    : null;
}

function parseOpenWeatherSettings(raw: unknown): {
  defaultSecret: SecretPayload | null;
  settings: JsonObject;
} {
  const settings = toJsonObject(raw) ?? {};
  const secretsRaw = (settings as { secrets?: unknown }).secrets;
  const defaultSecret =
    isRecord(secretsRaw) && 'default' in secretsRaw ? parseSecret(secretsRaw.default) : null;

  return { defaultSecret, settings };
}

async function getIntegrationRaw() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('external_integrations')
    .select('*')
    .eq('service', 'openweather')
    .maybeSingle();
  if (error) throw new Error(`DB error reading integration: ${error.message}`);
  if (!data) {
    return { enabled: false, apiKey: null } as OpenWeatherIntegration;
  }
  const key = getDataEncryptionKey();
  let apiKey: string | null = null;
  const row = data as Tables<'external_integrations'>;
  const { defaultSecret } = parseOpenWeatherSettings(row.settings);
  if (defaultSecret) {
    apiKey = decryptSecret(defaultSecret, key);
  }
  const trimmed = apiKey?.trim() || null;
  return { enabled: Boolean(row.enabled), apiKey: trimmed } as OpenWeatherIntegration;
}

export async function getOpenWeatherIntegration(): Promise<OpenWeatherIntegration> {
  return getIntegrationRaw();
}

export async function setOpenWeatherIntegration(params: {
  enabled: boolean;
  apiKey?: string | null;
  updatedBy?: string | null;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const cleanKey =
    typeof params.apiKey === 'string'
      ? params.apiKey.trim() === ''
        ? null
        : params.apiKey.trim()
      : (params.apiKey ?? null);

  type ExternalIntegrationsInsert = Database['public']['Tables']['external_integrations']['Insert'];
  type ExternalIntegrationsUpdate = Database['public']['Tables']['external_integrations']['Update'];
  const payload: ExternalIntegrationsInsert = {
    service: 'openweather',
    enabled: params.enabled,
    updated_by: params.updatedBy ?? null,
  };
  // We'll write encrypted key into settings.secrets.default

  const { data: existing, error: selectError } = await supabase
    .from('external_integrations')
    .select('id, settings')
    .eq('service', 'openweather')
    .maybeSingle();
  if (selectError) throw new Error(`DB error checking integration: ${selectError.message}`);

  if (existing) {
    // Merge settings with guards
    const existingSettings = toJsonObject(existing.settings) ?? {};
    let settings: JsonObject = { ...existingSettings };
    const existingSecrets = toJsonObject(existingSettings.secrets);
    let secrets: JsonObject | undefined = existingSecrets ? { ...existingSecrets } : undefined;
    if (typeof cleanKey === 'string') {
      const key = getDataEncryptionKey();
      const { ciphertextB64, ivB64, tagB64 } = encryptSecret(cleanKey, key);
      secrets = {
        ...(secrets ?? {}),
        default: { ciphertextB64, ivB64, tagB64 },
      };
    }
    if (secrets) {
      settings = { ...settings, secrets };
    }
    const updates: ExternalIntegrationsUpdate = {
      enabled: payload.enabled,
      updated_by: payload.updated_by ?? null,
      settings,
    };
    const { error: updateError } = await supabase
      .from('external_integrations')
      .update(updates)
      .eq('service', 'openweather');
    if (updateError) throw new Error(`DB error updating integration: ${updateError.message}`);
  } else {
    // Build settings for insert
    let settings: Json | null = null;
    if (typeof cleanKey === 'string') {
      const key = getDataEncryptionKey();
      const { ciphertextB64, ivB64, tagB64 } = encryptSecret(cleanKey, key);
      const secrets: Record<string, Json> = { default: { ciphertextB64, ivB64, tagB64 } };
      settings = { secrets };
    }
    const insertPayload: ExternalIntegrationsInsert = { ...payload, settings };
    const { error: insertError } = await supabase
      .from('external_integrations')
      .insert(insertPayload);
    if (insertError) throw new Error(`DB error creating integration: ${insertError.message}`);
  }
  revalidateTag(INTEGRATION_TAG);
}

export async function testOpenWeatherApiKey(
  keyToTest?: string | null
): Promise<{ ok: boolean; status: number; message: string }> {
  const apiKeyRaw = keyToTest ?? (await getOpenWeatherIntegration()).apiKey;
  const apiKey = apiKeyRaw?.trim() || null;
  if (!apiKey) {
    return { ok: false, status: 400, message: 'Missing API key' };
  }
  try {
    // Default test coords: somewhere in Maui, HI
    const latitude = 20.798363;
    const longitude = -156.331924;
    const url = new URL('https://api.openweathermap.org/data/3.0/onecall');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('exclude', 'minutely,hourly,alerts');
    url.searchParams.set('appid', apiKey);
    url.searchParams.set('units', 'imperial');
    const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, message: text || res.statusText };
    }
    await res.json();
    return { ok: true, status: 200, message: 'API key is valid' };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, status: 500, message };
  }
}
