'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type Mode = 'self' | 'admin'

export type ProfileDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  initial: { id: string; email: string; displayName: string; role: 'admin' | 'member'; avatarUrl: string | null }
  onSubmit: (values: { displayName: string; avatarFile: File | null; role?: 'admin' | 'member' }) => Promise<{ ok: boolean; error?: string }>
  title?: string
  description?: string
}

export default function ProfileDialog({ open, onOpenChange, mode, initial, onSubmit, title, description }: ProfileDialogProps) {
  const [pending, setPending] = React.useState(false)
  const [displayName, setDisplayName] = React.useState(initial.displayName)
  const [role, setRole] = React.useState<'admin' | 'member'>(initial.role)
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    setDisplayName(initial.displayName)
    setRole(initial.role)
  }, [initial.displayName, initial.role])

  React.useEffect(() => {
    if (!avatarFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(avatarFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return

    const trimmed = (displayName || '').trim()
    if (!trimmed) {
      // rely on inline message; avoid toasts here
      return
    }

    if (avatarFile) {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg']
      if (!validTypes.includes(avatarFile.type)) {
        return
      }
      const maxBytes = 5 * 1024 * 1024
      if (avatarFile.size > maxBytes) {
        return
      }
    }

    try {
      setPending(true)
      const res = await onSubmit({ displayName: trimmed, avatarFile, role: mode === 'admin' ? role : undefined })
      if (res.ok) {
        onOpenChange(false)
        setAvatarFile(null)
        setPreviewUrl(null)
      }
    } finally {
      setPending(false)
    }
  }

  const computedTitle = title || (mode === 'self' ? 'Manage profile' : 'Edit user')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{computedTitle}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Avatar className="size-16 sm:size-10 ring-1 ring-border">
              <AvatarImage src={previewUrl || initial.avatarUrl || undefined} alt={initial.displayName} />
              <AvatarFallback>{(initial.displayName || initial.email).slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="space-y-1 min-w-0">
              <Label>Email</Label>
              <div className="text-sm text-muted-foreground truncate">{initial.email}</div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-invalid={!displayName} />
            {!displayName ? <p className="text-destructive text-sm">Display name is required</p> : null}
          </div>
          {mode === 'admin' ? (
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'member')}>
                <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="avatar">Avatar</Label>
            <Input id="avatar" ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">PNG or JPEG up to 5MB. Recommended square image.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


