"use client"

import * as React from "react"
import { Laptop, Moon, Sun, Check } from "lucide-react"
import { useTheme } from "next-themes"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type ThemeSwitcherDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ThemeValue = "light" | "dark" | "system"

export function ThemeSwitcherDialog({ open, onOpenChange }: ThemeSwitcherDialogProps) {
  const { theme = "system", setTheme } = useTheme()
  const buttonRefs = React.useRef<Record<ThemeValue, HTMLButtonElement | null>>({
    light: null,
    dark: null,
    system: null,
  })

  const options = React.useMemo(
    () => [
      { value: "light" as const, label: "Light", Icon: Sun },
      { value: "dark" as const, label: "Dark", Icon: Moon },
      { value: "system" as const, label: "System", Icon: Laptop },
    ],
    []
  )

  function handleSelect(value: ThemeValue) {
    setTheme(value)
    onOpenChange(false)
  }

  React.useEffect(() => {
    if (!open) return
    const current = (theme as ThemeValue) || "system"
    const el = buttonRefs.current[current]
    if (el) {
      requestAnimationFrame(() => el.focus())
    }
  }, [open, theme])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Theme Switcher">
        <DialogHeader>
          <DialogTitle>Theme</DialogTitle>
          <DialogDescription>Select your preferred color theme.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2" role="listbox" aria-label="Theme options">
          {options.map(({ value, label, Icon }) => {
            const selected = theme === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleSelect(value)}
                ref={(el) => {
                  buttonRefs.current[value] = el
                }}
                role="option"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                className={
                  "flex items-center gap-3 rounded-md border px-3 py-2 text-left focus:outline-hidden focus:ring-2 focus:ring-ring hover:bg-accent " +
                  (selected ? "bg-accent" : "")
                }
              >
                <Icon className="size-4" />
                <span className="flex-1">{label}</span>
                {selected ? <Check className="size-4" aria-hidden="true" /> : null}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}


