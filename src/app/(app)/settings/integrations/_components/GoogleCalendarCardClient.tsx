"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { saveGoogleCalendarSettingsDirect, testGoogleCalendarAction, createTestEventAction } from '../_actions';
import { Calendar, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTimeZones } from '@vvo/tzdb';

type Props = {
  enabled: boolean;
  calendarId: string | null;
  hasServiceAccount: boolean;
};

// Static Google Calendar event color map (colorId -> { name, hex })
const GCAL_EVENT_COLORS: Record<string, { name: string; hex: string }> = {
  '1': { name: 'Lavender', hex: '#a4bdfc' },
  '2': { name: 'Sage', hex: '#7ae7bf' },
  '3': { name: 'Grape', hex: '#dbadff' },
  '4': { name: 'Flamingo', hex: '#ff887c' },
  '5': { name: 'Banana', hex: '#fbd75b' },
  '6': { name: 'Tangerine', hex: '#ffb878' },
  '7': { name: 'Peacock', hex: '#46d6db' },
  '8': { name: 'Graphite', hex: '#e1e1e1' },
  '9': { name: 'Blueberry', hex: '#5484ed' },
  '10': { name: 'Basil', hex: '#51b749' },
  '11': { name: 'Tomato', hex: '#dc2127' },
};

export default function GoogleCalendarCardClient({ enabled, calendarId, hasServiceAccount }: Props) {
  const [serviceAccountJson, setServiceAccountJson] = React.useState<string>("");
  const [isAllDay, setIsAllDay] = React.useState<boolean>(true);
  const serviceAccountEmail = React.useMemo(() => {
    try {
      if (!serviceAccountJson) return null;
      const obj = JSON.parse(serviceAccountJson);
      return typeof obj?.client_email === 'string' ? obj.client_email : null;
    } catch {
      return null;
    }
  }, [serviceAccountJson]);
  const tzList = React.useMemo(() => getTimeZones().filter((tz) => tz.countryCode === 'US'), []);
  const defaultTz = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);
  const [timezoneVal, setTimezoneVal] = React.useState<string>(defaultTz);
  const [colorIdVal, setColorIdVal] = React.useState<string>("");
  const formatOffset = (minutes: number) => {
    const sign = minutes >= 0 ? '+' : '-';
    const abs = Math.abs(minutes);
    const h = String(Math.floor(abs / 60)).padStart(2, '0');
    const m = String(abs % 60).padStart(2, '0');
    return `(UTC${sign}${h}:${m})`;
  };
  async function saveAction(formData: FormData) {
    await saveGoogleCalendarSettingsDirect(formData);
    toast.success('Settings saved');
  }
  async function testAction(formData: FormData) {
    const res = await testGoogleCalendarAction(formData);
    if (res.ok) toast.success(res.message); else toast.error(res.message || 'Test failed');
  }
  async function createTestEvent(formData: FormData) {
    const res = await createTestEventAction(formData);
    if (res.ok) toast.success('Test event created successfully'); else toast.error(res.message || 'Failed to create test event');
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <CardTitle>Google Calendar</CardTitle>
          <Badge variant="secondary">BETA</Badge>
        </div>
        <CardDescription>
          Sync planting activities to your Google Calendar. See the{' '}
          <a 
            href="https://developers.google.com/workspace/calendar/api/guides/overview" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Google Calendar API documentation
          </a>
          {' '}for technical details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form id="gcalSaveForm" action={saveAction} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="space-y-1">
              <Label htmlFor="g_enabled">Enabled</Label>
              <p className="text-sm text-muted-foreground">Turn Google Calendar integration on or off.</p>
            </div>
            <Switch id="g_enabled" name="enabled" defaultChecked={enabled} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="calendarId">Calendar ID</Label>
            <Input id="calendarId" name="calendarId" defaultValue={calendarId ?? ''} placeholder="primary or calendar@example.com" autoComplete="off" inputMode="text" />
            <p className="text-sm text-muted-foreground">
              With service accounts, &quot;primary&quot; refers to the service account’s own calendar. For a team calendar, paste that calendar’s ID here and share it with the service account (see below).{' '}
              <a 
                href="https://support.google.com/calendar/answer/37103" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Learn how to find a calendar ID
              </a>
              .
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              <Label htmlFor="serviceAccountJson">Service Account JSON</Label>
            </div>
            <Input
              id="serviceAccountJson"
              name="serviceAccountJson"
              type="password"
              placeholder={hasServiceAccount ? '•••••••••••••••••••••••' : 'Paste JSON here'}
              autoComplete="new-password"
              value={serviceAccountJson}
              onChange={(e) => setServiceAccountJson(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Paste the complete JSON file from Google Cloud Console. {' '}
              <a 
                href="https://developers.google.com/identity/protocols/oauth2/service-account#creatinganaccount" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Learn how to create one
              </a>
              .
            </p>
            <div className="rounded-md border border-dashed p-3">
              <div className="text-sm font-medium">Share the calendar with the service account</div>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                <li>Open the calendar’s Settings and sharing in Google Calendar.</li>
                <li>Under “Share with specific people or groups”, add the service account email.</li>
                <li>Grant permission “Make changes to events”.</li>
              </ol>
              {serviceAccountEmail ? (
                <div className="mt-2 flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 text-xs">{serviceAccountEmail}</code>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(serviceAccountEmail)}
                  >
                    Copy email
                  </Button>
                </div>
              ) : hasServiceAccount ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  For security, the saved email isn’t displayed. Paste the JSON again to reveal it.
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Note: With service accounts, “primary” refers to the service account’s own calendar. To use a team calendar, paste that calendar’s ID above and share it with the service account.
              </p>
            </div>
          </div>
        </form>
        <form id="gcalTestForm" action={testAction} className="hidden">
          <input type="hidden" name="calendarId" value={calendarId ?? ''} />
          <input type="hidden" name="serviceAccountJson" value={serviceAccountJson} />
        </form>

        <div className="flex gap-2">
          <Button type="submit" form="gcalSaveForm">Save</Button>
          <Button type="submit" form="gcalTestForm" variant="secondary">Test Connection</Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                Test Event Creation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Test Calendar Event</DialogTitle>
                <DialogDescription>
                  Test the Google Calendar API by creating a sample event.
                </DialogDescription>
              </DialogHeader>
              <form action={createTestEvent} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="testTitle">Title</Label>
                  <Input id="testTitle" name="title" placeholder="Test Event" defaultValue="Test Event" />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch id="allDay" name="allDay" checked={isAllDay} onCheckedChange={setIsAllDay} />
                  <Label htmlFor="allDay">All day event</Label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="testDate">Date</Label>
                    <Input id="testDate" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                  {!isAllDay && (
                    <div className="space-y-2">
                      <Label htmlFor="testTime">Start Time</Label>
                      <Input id="testTime" name="startTime" type="time" defaultValue="09:00" />
                    </div>
                  )}
                </div>

                {!isAllDay && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="testEndDate">End Date</Label>
                      <Input id="testEndDate" name="endDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="testEndTime">End Time</Label>
                      <Input id="testEndTime" name="endTime" type="time" defaultValue="10:00" />
                    </div>
                  </div>
                )}

                {!isAllDay && (
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Time Zone</Label>
                    <input type="hidden" name="timezone" value={timezoneVal} />
                    <Select value={timezoneVal} onValueChange={setTimezoneVal}>
                      <SelectTrigger>
                        <SelectValue placeholder={defaultTz} />
                      </SelectTrigger>
                      <SelectContent className="max-h-64 overflow-y-auto">
                        {tzList.map((tz) => (
                          <SelectItem key={tz.name} value={tz.name}>
                            {formatOffset(tz.currentTimeOffsetInMinutes)} {tz.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <input type="hidden" name="colorId" value={colorIdVal} />
                  <Select value={colorIdVal} onValueChange={setColorIdVal}>
                    <SelectTrigger>
                      <SelectValue placeholder="Default" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(GCAL_EVENT_COLORS).map(([id, meta]) => (
                        <SelectItem key={id} value={id}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full border border-black/10"
                              style={{ backgroundColor: meta.hex }}
                              aria-hidden
                            />
                            <span>{meta.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="testDescription">Description</Label>
                  <Textarea id="testDescription" name="description" placeholder="Optional description" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="testLocation">Location</Label>
                  <Input id="testLocation" name="location" placeholder="Optional location" />
                </div>
                <Button type="submit" className="w-full">Create Test Event</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
