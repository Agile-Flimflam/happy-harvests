"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, icon, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6", className)}>
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold truncate">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground truncate">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex-shrink-0">{action}</div> : null}
    </div>
  )
}

export default PageHeader


