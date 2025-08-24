import 'server-only';

import { google, calendar_v3 } from 'googleapis';
import { createSupabaseAdminClient } from './supabase-admin';
import { decryptSecret, getDataEncryptionKey } from './crypto';
import type { Tables } from './supabase-server';

type GoogleCalendarIntegration = {
  enabled: boolean;
  calendarId: string | null;
  serviceAccount: {
    client_email: string;
    private_key: string;
    private_key_id?: string;
  } | null;
};

async function getGoogleCalendarIntegration(): Promise<GoogleCalendarIntegration> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('external_integrations')
    .select('*')
    .eq('service', 'google_calendar')
    .maybeSingle();
  if (error) throw new Error(`DB error reading Google Calendar integration: ${error.message}`);
  if (!data) return { enabled: false, calendarId: null, serviceAccount: null };
  const row = data as Tables<'external_integrations'> & { settings?: Record<string, unknown> };
  const settings = (row.settings as unknown as { calendar_id?: string; secrets?: Record<string, unknown> } | null) || null;
  let serviceAccount: GoogleCalendarIntegration['serviceAccount'] = null;
  const defaultSecret = (settings?.secrets as Record<string, unknown> | undefined)?.['default'] as
    | { ciphertextB64?: string; ivB64?: string; tagB64?: string }
    | undefined;
  if (defaultSecret?.ciphertextB64 && defaultSecret?.ivB64 && defaultSecret?.tagB64) {
    try {
      const key = getDataEncryptionKey();
      const plaintext = decryptSecret(
        {
          ciphertextB64: defaultSecret.ciphertextB64,
          ivB64: defaultSecret.ivB64,
          tagB64: defaultSecret.tagB64,
        },
        key
      );
      const json = JSON.parse(plaintext) as { client_email: string; private_key: string; private_key_id?: string };
      serviceAccount = {
        client_email: json.client_email,
        private_key: json.private_key,
        private_key_id: json.private_key_id,
      };
    } catch {
      serviceAccount = null;
    }
  }
  return {
    enabled: Boolean(row.enabled),
    calendarId: settings?.calendar_id ?? null,
    serviceAccount,
  };
}

function getAuthClient(sa: NonNullable<GoogleCalendarIntegration['serviceAccount']>) {
  const jwt = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  });
  return jwt;
}

export async function insertCalendarEvent(event: calendar_v3.Schema$Event): Promise<{ ok: boolean; id?: string; message?: string }> {
  const integration = await getGoogleCalendarIntegration();
  if (!integration.enabled) return { ok: false, message: 'Google Calendar integration disabled' };
  if (!integration.calendarId) return { ok: false, message: 'Missing calendar id' };
  if (!integration.serviceAccount) return { ok: false, message: 'Missing service account' };
  const auth = getAuthClient(integration.serviceAccount);
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    const res = await calendar.events.insert({
      calendarId: integration.calendarId,
      requestBody: event,
      conferenceDataVersion: 0,
      supportsAttachments: false,
    });
    return { ok: true, id: res.data.id ?? undefined };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, message };
  }
}

export async function updateCalendarEvent(eventId: string, event: calendar_v3.Schema$Event): Promise<{ ok: boolean; message?: string }> {
  const integration = await getGoogleCalendarIntegration();
  if (!integration.enabled || !integration.calendarId || !integration.serviceAccount) {
    return { ok: false, message: 'Integration not fully configured' };
  }
  const auth = getAuthClient(integration.serviceAccount);
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.update({
      calendarId: integration.calendarId,
      eventId,
      requestBody: event,
      conferenceDataVersion: 0,
      supportsAttachments: false,
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, message };
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<{ ok: boolean; message?: string }> {
  const integration = await getGoogleCalendarIntegration();
  if (!integration.enabled || !integration.calendarId || !integration.serviceAccount) {
    return { ok: false, message: 'Integration not fully configured' };
  }
  const auth = getAuthClient(integration.serviceAccount);
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.delete({ calendarId: integration.calendarId, eventId });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, message };
  }
}

export async function testGoogleCalendar(options?: { serviceAccountJson?: string; calendarId?: string }): Promise<{ ok: boolean; message: string }>{
  try {
    let integration = await getGoogleCalendarIntegration();
    if (options?.serviceAccountJson) {
      try {
        const json = JSON.parse(options.serviceAccountJson) as { client_email: string; private_key: string };
        integration = {
          enabled: true,
          calendarId: options.calendarId ?? integration.calendarId,
          serviceAccount: { client_email: json.client_email, private_key: json.private_key },
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid JSON';
        return { ok: false, message: `Invalid service account JSON: ${msg}` };
      }
    } else if (options?.calendarId) {
      integration = { ...integration, calendarId: options.calendarId };
    }

    if (!integration.enabled) return { ok: false, message: 'Integration disabled' };
    if (!integration.calendarId) return { ok: false, message: 'Missing calendar id' };
    if (!integration.serviceAccount) return { ok: false, message: 'Missing service account' };

    const auth = getAuthClient(integration.serviceAccount);
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.list({ calendarId: integration.calendarId, maxResults: 1, singleEvents: true });
    return { ok: true, message: 'Google Calendar accessible' };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, message };
  }
}


