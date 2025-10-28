'use client'

import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'

export type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string | ReactNode
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'default' | 'destructive' | 'outline' | 'secondary'
  confirming?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'destructive',
  confirming = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!confirming) onOpenChange(next) }}>
      <DialogContent
        className="sm:max-w-[425px]"
        onEscapeKeyDown={(e) => { if (confirming) e.preventDefault() }}
        onInteractOutside={(e) => { if (confirming) e.preventDefault() }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onConfirm()
          }}
        >
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={confirming} aria-disabled={confirming}>{cancelText}</Button>
            </DialogClose>
            <Button type="submit" variant={confirmVariant} disabled={confirming} aria-disabled={confirming} autoFocus>
              {confirming ? 'Please wait…' : confirmText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


