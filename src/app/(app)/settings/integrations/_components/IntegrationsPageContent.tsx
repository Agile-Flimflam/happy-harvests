import OpenWeatherCardClient from './OpenWeatherCardClient';
import { getOpenWeatherIntegration } from '@/lib/integrations';

export async function IntegrationsPageContent() {
  const integration = await getOpenWeatherIntegration();
  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
      <div className="grid gap-6 grid-cols-1">
        <OpenWeatherCardClient enabled={integration.enabled} apiKeyHint={integration.apiKeyHint} />
      </div>
    </div>
  );
}


