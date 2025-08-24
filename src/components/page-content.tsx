"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type PageContentProps = React.PropsWithChildren<{
  className?: string
}>

export function PageContent({ className, children }: PageContentProps) {
  return <div className={cn("space-y-6", className)}>{children}</div>
}

export default PageContent


