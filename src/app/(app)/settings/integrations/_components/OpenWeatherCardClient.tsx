"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { saveOpenWeatherSettingsDirect, testOpenWeatherKeyAction, revealOpenWeatherKeyAction } from '../_actions';
import { Eye, EyeOff, CloudSun } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  enabled: boolean;
  apiKeyHint: string | null;
};

export default function OpenWeatherCardClient({ enabled, apiKeyHint }: Props) {
  const hasStoredKey = Boolean(apiKeyHint);
  const [apiKeyInput, setApiKeyInput] = React.useState<string>("");
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [revealing, setRevealing] = React.useState(false);
  async function saveAction(formData: FormData) {
    await saveOpenWeatherSettingsDirect(formData);
    toast.success('Settings saved');
  }
  async function testAction(formData: FormData) {
    // Ensure apiKey from current input is included
    const key = apiKeyInput.trim();
    if (key) formData.set('apiKey', key);
    const res = await testOpenWeatherKeyAction(formData);
    if (res.ok) toast.success('API key is valid'); else toast.error(res.message || 'Test failed');
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CloudSun className="h-5 w-5" />
          <CardTitle>OpenWeather</CardTitle>
        </div>
        <CardDescription>Enable weather features and manage API key.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Save form holds the fields */}
        <form id="saveForm" action={saveAction} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="space-y-1">
              <Label htmlFor="enabled">Enabled</Label>
              <p className="text-sm text-muted-foreground">Turn OpenWeather integration on or off.</p>
            </div>
            <Switch id="enabled" name="enabled" defaultChecked={enabled} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                name="apiKey"
                type={revealed ? 'text' : 'password'}
                placeholder={revealed !== null ? 'Enter API key' : (hasStoredKey ? '•••••••••••••••••••••••' : 'Enter API key')}
                value={revealed ?? apiKeyInput}
                onChange={(e) => (revealed !== null ? setRevealed(e.target.value) : setApiKeyInput(e.target.value))}
                className="pr-10"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={async () => {
                  if (revealed !== null) {
                    setRevealed(null);
                    return;
                  }
                  setRevealing(true);
                  const res = await revealOpenWeatherKeyAction();
                  setRevealing(false);
                  if (res.ok && res.apiKey) {
                    setRevealed(res.apiKey);
                  } else {
                    toast.error(res.message || 'Unable to reveal key');
                  }
                }}
                disabled={revealing}
                aria-label={revealed ? 'Hide API key' : 'Reveal API key'}
              >
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          
        </form>

        {/* Separate sibling form for testing to avoid nested forms */}
        <form id="testForm" action={testAction} className="hidden">
          <input type="hidden" name="apiKey" value={apiKeyInput} />
        </form>

        {/* Buttons on the same row, each submits its corresponding form */}
        <div className="flex gap-2">
          <Button type="submit" form="saveForm">
            Save
          </Button>
          <Button type="submit" form="testForm" variant="secondary">
            Test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
