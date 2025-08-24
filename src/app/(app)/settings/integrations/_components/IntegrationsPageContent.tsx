import OpenWeatherCardClient from './OpenWeatherCardClient';
import GoogleCalendarCardClient from './GoogleCalendarCardClient';
import { getOpenWeatherIntegration } from '@/lib/integrations';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import PageHeader from '@/components/page-header'
import PageContent from '@/components/page-content'

export async function IntegrationsPageContent() {
  const integration = await getOpenWeatherIntegration();
  // Load Google Calendar settings
  const supabase = createSupabaseAdminClient();
  const { data: gcalData } = await supabase
    .from('external_integrations')
    .select('enabled, settings')
    .eq('service', 'google_calendar')
    .maybeSingle();
  const gEnabled = Boolean(gcalData?.enabled);
  const gSettings = (gcalData?.settings as unknown as { calendar_id?: string; secrets?: Record<string, unknown> } | null) || null;
  const defaultSecret = (gSettings?.secrets as Record<string, unknown> | undefined)?.['default'] as
    | { ciphertextB64?: string; ivB64?: string; tagB64?: string }
    | undefined;
  const hasServiceAccount = Boolean(defaultSecret?.ciphertextB64 && defaultSecret?.ivB64 && defaultSecret?.tagB64);
  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" />
      <PageContent>
        <div className="grid gap-6 grid-cols-1">
          <OpenWeatherCardClient enabled={integration.enabled} hasKey={Boolean(integration.apiKey)} />
          <GoogleCalendarCardClient enabled={gEnabled} calendarId={gSettings?.calendar_id ?? null} hasServiceAccount={hasServiceAccount} />
        </div>
      </PageContent>
    </div>
  );
}
