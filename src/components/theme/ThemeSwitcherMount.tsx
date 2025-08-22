"use client"

import * as React from "react"
import { ThemeHotkeys } from "@/components/theme/ThemeHotkeys"
import { ThemeSwitcherDialog } from "@/components/theme/ThemeSwitcherDialog"
import { useTheme } from "next-themes"

export function ThemeSwitcherMount() {
  const [open, setOpen] = React.useState(false)
  const { theme, setTheme } = useTheme()

  const cycleTheme = React.useCallback(() => {
    type ThemeValue = "light" | "dark" | "system"
    const order: ThemeValue[] = ["light", "dark", "system"]
    const isThemeValue = (value: unknown): value is ThemeValue =>
      value === "light" || value === "dark" || value === "system"
    const current: ThemeValue = isThemeValue(theme) ? theme : "system"
    const idx = order.indexOf(current)
    const next = order[(idx + 1 + order.length) % order.length]
    setTheme(next)
    setOpen(true)
  }, [theme, setTheme])


  return (
    <>
      <ThemeHotkeys onCmdJ={cycleTheme} />
      <ThemeSwitcherDialog open={open} onOpenChange={setOpen} />
    </>
  )
}


