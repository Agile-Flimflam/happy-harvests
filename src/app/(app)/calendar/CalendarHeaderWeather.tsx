'use client';

import { WeatherBadge } from '@/components/weather/WeatherBadge';
import { moonEmojiFromLabel } from '@/lib/hawaiian-moon';
import type { WeatherSnapshot } from '../locations/actions';

type Props = {
  weather?: WeatherSnapshot | null;
};

export default function CalendarHeaderWeather({ weather }: Props) {
  if (!weather) {
    return (
      <div className="text-sm text-muted-foreground">
        Set a location with coordinates to see weather and moon
      </div>
    );
  }

  const { current, moonPhaseLabel } = weather;
  const safeMoonPhaseLabel = moonPhaseLabel ?? '';
  const tempF = current.temp;
  const icon = current.weather?.icon || null;
  const description = current.weather?.description || null;
  // Compute the same emoji used in calendar days for consistency
  const moonEmoji = moonEmojiFromLabel(safeMoonPhaseLabel);

  return (
    <div className="flex items-center gap-4 text-sm rounded-md bg-muted/40 px-3 py-2">
      <WeatherBadge
        icon={icon}
        tempF={tempF}
        description={description}
        inlineDescription
        hawaiianMoon={safeMoonPhaseLabel}
        moonEmoji={moonEmoji}
        size="sm"
      />
    </div>
  );
}
