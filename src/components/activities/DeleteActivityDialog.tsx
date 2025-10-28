"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export function DeleteActivityDialog({
  formId,
  size = 'sm',
  className,
}: {
  formId: string
  size?: 'sm' | 'default'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function onConfirm() {
    const form = document.getElementById(formId) as HTMLFormElement | null
    if (!form) {
      setOpen(false)
      return
    }
    try {
      setConfirming(true)
      form.requestSubmit()
    } finally {
      setConfirming(false)
      setOpen(false)
    }
  }

  return (
    <>
      <Button type="button" size={size} variant="destructive" className={className} onClick={() => setOpen(true)}>
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete activity?"
        description="Are you sure you want to delete this activity? This action cannot be undone."
        confirmText="Delete"
        confirmVariant="destructive"
        confirming={confirming}
        onConfirm={onConfirm}
      />
    </>
  )
}
