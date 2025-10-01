"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type FormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  submitLabel?: string
  cancelLabel?: string
  formId?: string
  children: React.ReactNode
  className?: string
}

export default function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  cancelLabel = "Cancel",
  formId,
  children,
  className,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("flex max-h-[85vh] w-full max-w-[calc(100vw-2rem)] flex-col overflow-visible px-0 py-6", className)}>
        <DialogHeader className="shrink-0 px-6">
          <DialogTitle className="whitespace-normal break-words">{title}</DialogTitle>
          {description ? <DialogDescription className="whitespace-normal break-words">{description}</DialogDescription> : null}
        </DialogHeader>
        <div
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" as React.CSSProperties["overscrollBehavior"] }}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-visible"
        >
          <div className="px-6">
            {children}
          </div>
        </div>
        <DialogFooter className="shrink-0 px-6">
          {submitLabel && formId ? (
            <>
              <DialogClose asChild>
                <Button variant="outline">{cancelLabel}</Button>
              </DialogClose>
              <Button type="submit" form={formId}>{submitLabel}</Button>
            </>
          ) : (
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
