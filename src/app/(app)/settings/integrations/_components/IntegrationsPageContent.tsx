import OpenWeatherCardClient from './OpenWeatherCardClient';
import GoogleCalendarCardClient from './GoogleCalendarCardClient';
import PageHeader from '@/components/page-header';
import PageContent from '@/components/page-content';
import { getIntegrationsPageData } from '../actions';

export async function IntegrationsPageContent() {
  const { openWeather, googleCalendar, error } = await getIntegrationsPageData();
  const safeOpenWeather = openWeather ?? { enabled: false, hasKey: false };
  const safeGoogleCalendar = googleCalendar ?? {
    enabled: false,
    calendarId: null,
    hasServiceAccount: false,
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" />
      <PageContent>
        <div className="grid gap-6 grid-cols-1">
          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
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
