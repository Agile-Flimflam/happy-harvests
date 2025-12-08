import OpenWeatherCardClient from './OpenWeatherCardClient';
import GoogleCalendarCardClient from './GoogleCalendarCardClient';
import PageHeader from '@/components/page-header';
import PageContent from '@/components/page-content';
import { getIntegrationsPageData } from '../actions';

export async function IntegrationsPageContent() {
  const { openWeather, googleCalendar, error } = await getIntegrationsPageData();
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
          <OpenWeatherCardClient enabled={openWeather.enabled} hasKey={openWeather.hasKey} />
          <GoogleCalendarCardClient
            enabled={googleCalendar.enabled}
            calendarId={googleCalendar.calendarId}
            hasServiceAccount={googleCalendar.hasServiceAccount}
          />
        </div>
      </PageContent>
    </div>
  );
}
