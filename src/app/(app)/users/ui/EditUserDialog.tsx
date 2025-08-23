'use client'

import * as React from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type Props = {
  user: { id: string; email: string; displayName: string; role: 'admin' | 'member'; avatarUrl?: string | null } | null
  onClose: () => void
  onSaveProfile: (formData: FormData) => Promise<{ ok: boolean; error?: string; user?: { id: string; displayName: string; role: 'admin' | 'member'; avatarUrl: string | null } }>
}

export default function EditUserDialog({ user, onClose, onSaveProfile }: Props) {
  const open = !!user
  const [role, setRole] = React.useState<'admin' | 'member'>(user?.role ?? 'member')
  const [displayName, setDisplayName] = React.useState(user?.displayName ?? '')
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    setRole(user?.role ?? 'member')
    setDisplayName(user?.displayName ?? '')
    setAvatarFile(null)
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    try {
      setPending(true)
      const fd = new FormData()
      fd.append('userId', user.id)
      fd.append('role', role)
      fd.append('displayName', displayName)
      if (avatarFile) fd.append('avatar', avatarFile)
      const res = await onSaveProfile(fd)
      if (!res.ok) {
        toast.error(res.error || 'Failed to update user')
        return
      }
      toast.success('User updated')
      onClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
        </DialogHeader>
        {user ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-3">
              <Image
                src={user.avatarUrl || '/file.svg'}
                alt={user.displayName}
                width={40}
                height={40}
                className="rounded-full ring-1 ring-border object-cover"
              />
              <div className="space-y-1">
                <Label>Email</Label>
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'member')}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar">Avatar</Label>
              <Input id="avatar" type="file" accept="image/png,image/jpeg,image/jpg" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}


