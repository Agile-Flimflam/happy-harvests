'use client'

import Image from 'next/image'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type WeatherBadgeProps = {
  icon: string | null | undefined
  tempF: number | null | undefined
  description?: string | null
  inlineDescription?: boolean
  size?: 'sm' | 'md'
}

export function WeatherBadge({ icon, tempF, description, inlineDescription = false, size = 'md' }: WeatherBadgeProps) {
  const iconSize = size === 'sm' ? 24 : 32
  const tipIconSize = size === 'sm' ? 22 : 28
  const temperature = typeof tempF === 'number' ? `${Math.round(tempF)}°F` : '—'

  return (
    <div className="flex flex-col gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              {icon ? (
                <Image
                  src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
                  alt={description || 'Weather icon'}
                  width={iconSize}
                  height={iconSize}
                />
              ) : null}
              <span className="text-sm font-semibold">{temperature}</span>
              {inlineDescription && description ? (
                <span className="text-xs text-muted-foreground capitalize">{description}</span>
              ) : null}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex items-center gap-2">
              {icon ? (
                <Image
                  src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
                  alt={description || 'Weather icon'}
                  width={tipIconSize}
                  height={tipIconSize}
                />
              ) : null}
              <span className="text-sm font-semibold">{temperature}</span>
            </div>
            {description ? (
              <div className="mt-1 text-sm capitalize">{description}</div>
            ) : null}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}



