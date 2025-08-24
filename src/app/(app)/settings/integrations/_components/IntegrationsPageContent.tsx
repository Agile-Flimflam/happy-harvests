import OpenWeatherCardClient from './OpenWeatherCardClient';
import { getOpenWeatherIntegration } from '@/lib/integrations';
import PageHeader from '@/components/page-header'
import PageContent from '@/components/page-content'

export async function IntegrationsPageContent() {
  const integration = await getOpenWeatherIntegration();
  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" />
      <PageContent>
        <div className="grid gap-6 grid-cols-1">
          <OpenWeatherCardClient enabled={integration.enabled} apiKeyHint={integration.apiKeyHint} />
        </div>
      </PageContent>
    </div>
  );
}
