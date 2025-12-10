import OpenWeatherCardClient from './OpenWeatherCardClient';
import GoogleCalendarCardClient from './GoogleCalendarCardClient';
import PageHeader from '@/components/page-header';
import PageContent from '@/components/page-content';
import { getIntegrationsPageData } from '../actions';

function formatError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

export async function IntegrationsPageContent() {
  let data:
    | Awaited<ReturnType<typeof getIntegrationsPageData>>
    | {
        openWeather: { enabled: boolean; hasKey: boolean };
        googleCalendar: { enabled: boolean; calendarId: string | null; hasServiceAccount: boolean };
        error: string;
      };

  try {
    data = (await getIntegrationsPageData()) ?? {
      openWeather: { enabled: false, hasKey: false },
      googleCalendar: { enabled: false, calendarId: null, hasServiceAccount: false },
      error: 'Unable to load integrations',
    };
  } catch (err) {
    console.error('[IntegrationsPageContent] Failed to load integrations', err);
    data = {
      openWeather: { enabled: false, hasKey: false },
      googleCalendar: { enabled: false, calendarId: null, hasServiceAccount: false },
      error: formatError(err),
    };
  }

  const { openWeather, googleCalendar, error } = data;
  const safeOpenWeather = openWeather ?? { enabled: false, hasKey: false };
  const safeGoogleCalendar = googleCalendar ?? {
    enabled: false,
    calendarId: null,
    hasServiceAccount: false,
  };
  const safeError = typeof error === 'string' ? error : error ? String(error) : undefined;
  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" />
      <PageContent>
        <div className="grid gap-6 grid-cols-1">
          {safeError ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {safeError}
            </div>
          ) : null}
          <OpenWeatherCardClient
            enabled={safeOpenWeather.enabled}
            hasKey={safeOpenWeather.hasKey}
          />
          <GoogleCalendarCardClient
            enabled={safeGoogleCalendar.enabled}
            calendarId={safeGoogleCalendar.calendarId}
            hasServiceAccount={safeGoogleCalendar.hasServiceAccount}
          />
        </div>
      </PageContent>
    </div>
  );
}
