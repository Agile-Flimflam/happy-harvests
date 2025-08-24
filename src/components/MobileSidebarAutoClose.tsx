"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { useSidebar } from "@/components/ui/sidebar"

export function MobileSidebarAutoClose() {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
    // We intentionally depend on pathname and isMobile so that
    // any navigation on mobile closes the sheet.
  }, [pathname, isMobile, setOpenMobile])

  return null
}


