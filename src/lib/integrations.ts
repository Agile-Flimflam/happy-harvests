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
    return { enabled: false, apiKey: null } as OpenWeatherIntegration;
  }
  const key = getDataEncryptionKey();
  let apiKey: string | null = null;
  const row = data as Tables<'external_integrations'> & { settings?: Record<string, unknown> };
  try {
    const settings = (row.settings as unknown as { secrets?: Record<string, unknown> } | null) || null;
    const def = (settings?.secrets as Record<string, unknown> | undefined)?.['default'] as
      | { ciphertextB64?: string; ivB64?: string; tagB64?: string }
      | undefined;
    if (def?.ciphertextB64 && def?.ivB64 && def?.tagB64) {
      apiKey = decryptSecret(
        {
          ciphertextB64: def.ciphertextB64,
          ivB64: def.ivB64,
          tagB64: def.tagB64,
        },
        key
      );
    }
  } catch {
    apiKey = null;
  }
  return { enabled: Boolean(row.enabled), apiKey } as OpenWeatherIntegration;
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
  // We'll write encrypted key into settings.secrets.default

  const { data: existing, error: selectError } = await supabase
    .from('external_integrations')
    .select('id, settings')
    .eq('service', 'openweather')
    .maybeSingle();
  if (selectError) throw new Error(`DB error checking integration: ${selectError.message}`);

  if (existing) {
    // Merge settings
    let settings: Record<string, Json> = {};
    try {
      settings = (existing.settings as unknown as Record<string, Json>) || {};
    } catch {
      settings = {};
    }
    if (typeof params.apiKey === 'string') {
      const key = getDataEncryptionKey();
      const { ciphertextB64, ivB64, tagB64 } = encryptSecret(params.apiKey, key);
      const secrets: Record<string, Json> = {
        ...(settings.secrets as Record<string, Json> | undefined),
        default: { ciphertextB64, ivB64, tagB64 } as unknown as Json,
      };
      settings = { ...settings, secrets };
    }
    const updates: ExternalIntegrationsUpdate = {
      enabled: payload.enabled,
      updated_by: payload.updated_by ?? null,
      settings: settings as unknown as Json,
    };
    const { error: updateError } = await supabase
      .from('external_integrations')
      .update(updates as never)
      .eq('service', 'openweather');
    if (updateError) throw new Error(`DB error updating integration: ${updateError.message}`);
  } else {
    // Build settings for insert
    let settings: Json | null = null;
    if (typeof params.apiKey === 'string') {
      const key = getDataEncryptionKey();
      const { ciphertextB64, ivB64, tagB64 } = encryptSecret(params.apiKey, key);
      const secrets: Record<string, Json> = { default: { ciphertextB64, ivB64, tagB64 } };
      settings = ({ secrets } as unknown) as Json;
    }
    const { error: insertError } = await supabase
      .from('external_integrations')
      .insert({ ...payload, settings } as never);
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
