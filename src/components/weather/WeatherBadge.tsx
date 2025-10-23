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
}

export function WeatherBadge({ icon, tempF, description, inlineDescription = false, hawaiianMoon, size = 'md' }: WeatherBadgeProps) {
  const px = size === 'sm' ? 24 : 32
  const moonTip = hawaiianMoonRecommendationByName(hawaiianMoon ?? undefined)
  return (
    <div className="inline-flex items-center gap-2">
      {icon ? (
        <Image
          src={`https://openweathermap.org/img/wn/@{icon}@2x.png`}
          alt={description || 'Weather'}
          width={px}
          height={px}
          unoptimized
        />
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
                  <span className="text-muted-foreground text-sm cursor-help underline decoration-dotted underline-offset-2">{hawaiianMoon}</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] text-sm">
                  {moonTip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="text-muted-foreground text-sm">{hawaiianMoon}</span>
          )
        ) : null}
      </div>
    </div>
  )
}


