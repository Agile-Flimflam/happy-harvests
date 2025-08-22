"use client"

import * as React from "react"

type ThemeHotkeysProps = {
  onCmdJ: () => void
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === "input" || tag === "textarea" || (target as HTMLElement).isContentEditable) return true
  const role = target.getAttribute("role")
  if (role && ["textbox", "searchbox", "combobox"].includes(role)) return true
  return false
}

export function ThemeHotkeys({ onCmdJ }: ThemeHotkeysProps) {
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableElement(e.target)) return

      const isMac = navigator.platform.toUpperCase().includes("MAC")
      const primary = isMac ? e.metaKey : e.ctrlKey

      if (primary && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault()
        onCmdJ()
        return
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onCmdJ])

  return null
}



