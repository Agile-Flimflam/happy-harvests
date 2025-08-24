import 'server-only';

import { revalidateTag } from 'next/cache';
import { createSupabaseAdminClient } from './supabase-admin';
import { decryptSecret, encryptSecret, getDataEncryptionKey } from './crypto';
import type { Tables } from './supabase-server';
import type { Database } from './database.types';

type OpenWeatherIntegration = {
  enabled: boolean;
  apiKey: string | null;
  apiKeyHint: string | null;
};

const INTEGRATION_TAG = 'integration-openweather';

async function getIntegrationRaw() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('external_integrations')
    .select('*')
    .eq('service', 'openweather')
    .maybeSingle();
  if (error) throw new Error(`DB error reading integration: ${error.message}`);
  if (!data) {
    return { enabled: false, apiKey: null, apiKeyHint: null } as OpenWeatherIntegration;
  }
  const key = getDataEncryptionKey();
  let apiKey: string | null = null;
  const row = data as Tables<'external_integrations'>;
  if (row.api_key_ciphertext && row.api_key_iv && row.api_key_tag) {
    try {
      apiKey = decryptSecret(
        {
          ciphertextB64: row.api_key_ciphertext,
          ivB64: row.api_key_iv,
          tagB64: row.api_key_tag,
        },
        key
      );
    } catch {
      apiKey = null;
    }
  }
  return { enabled: Boolean(row.enabled), apiKey, apiKeyHint: row.api_key_hint ?? null } as OpenWeatherIntegration;
}

export async function getOpenWeatherIntegration(): Promise<OpenWeatherIntegration> {
  return getIntegrationRaw();
}

export async function setOpenWeatherIntegration(params: { enabled: boolean; apiKey?: string | null; updatedBy?: string | null; }): Promise<void> {
  const supabase = createSupabaseAdminClient();

  type ExternalIntegrationsInsert = Database['public']['Tables']['external_integrations']['Insert'];
  type ExternalIntegrationsUpdate = Database['public']['Tables']['external_integrations']['Update'];
  const payload: ExternalIntegrationsInsert = {
    service: 'openweather',
    enabled: params.enabled,
    updated_by: params.updatedBy ?? null,
  };
  if (typeof params.apiKey === 'string') {
    const key = getDataEncryptionKey();
    const { ciphertextB64, ivB64, tagB64 } = encryptSecret(params.apiKey, key);
    payload.api_key_ciphertext = ciphertextB64;
    payload.api_key_iv = ivB64;
    payload.api_key_tag = tagB64;
    payload.api_key_hint = params.apiKey.slice(-4);
  }

  const { data: existing, error: selectError } = await supabase
    .from('external_integrations')
    .select('id')
    .eq('service', 'openweather')
    .maybeSingle();
  if (selectError) throw new Error(`DB error checking integration: ${selectError.message}`);

  if (existing) {
    const updates: ExternalIntegrationsUpdate = {
      enabled: payload.enabled,
      updated_by: payload.updated_by ?? null,
      api_key_ciphertext: payload.api_key_ciphertext ?? undefined,
      api_key_iv: payload.api_key_iv ?? undefined,
      api_key_tag: payload.api_key_tag ?? undefined,
      api_key_hint: payload.api_key_hint ?? undefined,
    };
    const { error: updateError } = await supabase
      .from('external_integrations')
      .update(updates as never)
      .eq('service', 'openweather');
    if (updateError) throw new Error(`DB error updating integration: ${updateError.message}`);
  } else {
    const { error: insertError } = await supabase
      .from('external_integrations')
      .insert(payload as never);
    if (insertError) throw new Error(`DB error creating integration: ${insertError.message}`);
  }
  revalidateTag(INTEGRATION_TAG);
}

export async function testOpenWeatherApiKey(keyToTest?: string | null): Promise<{ ok: boolean; status: number; message: string }> {
  const apiKey = keyToTest ?? (await getOpenWeatherIntegration()).apiKey;
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
