import Image from 'next/image'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { hawaiianMoonRecommendationByName } from '@/lib/hawaiian-moon'

type WeatherBadgeProps = {
  icon: string | null | undefined
  tempF: number | null | undefined
  description: string | null | undefined
  inlineDescription?: boolean
  hawaiianMoon?: string | null | undefined
  size?: 'sm' | 'md'
  moonEmoji?: string | null
}

export function WeatherBadge({ icon, tempF, description, inlineDescription = false, hawaiianMoon, size = 'md', moonEmoji = null }: WeatherBadgeProps) {
  const px = size === 'sm' ? 28 : 40
  const moonTip = hawaiianMoonRecommendationByName(hawaiianMoon ?? undefined)
  return (
    <div className="inline-flex items-center gap-2">
      {icon ? (
        <span className="inline-flex items-center justify-center rounded-full p-1 bg-foreground/10 ring-1 ring-border shadow-sm">
          <Image
            className="drop-shadow"
            src={`https://openweathermap.org/img/wn/${icon.replace('@2x','')}@2x.png`}
            alt={description || 'Weather'}
            width={px}
            height={px}
            unoptimized
          />
        </span>
      ) : null}
      <div className="inline-flex items-center gap-2">
        {typeof tempF === 'number' ? <span className="font-medium">{Math.round(tempF)}°F</span> : null}
        {inlineDescription && description ? (
          <span className="text-muted-foreground capitalize text-sm">{description}</span>
        ) : null}
        {hawaiianMoon ? (
          moonTip ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 text-muted-foreground text-sm cursor-help underline decoration-dotted underline-offset-2">
                    <span aria-hidden="true">{moonEmoji ?? '🌙'}</span>
                    {hawaiianMoon}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] text-sm">
                  {moonTip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground text-sm"><span aria-hidden="true">{moonEmoji ?? '🌙'}</span>{hawaiianMoon}</span>
          )
        ) : null}
      </div>
    </div>
  )
}


