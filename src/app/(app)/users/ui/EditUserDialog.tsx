'use client'

import * as React from 'react'
import ProfileDialog from '@/components/users/ProfileDialog'

type Props = {
  user: { id: string; email: string; displayName: string; role: 'admin' | 'member'; avatarUrl?: string | null } | null
  onClose: () => void
  onSaveProfile: (formData: FormData) => Promise<{ ok: boolean; error?: string; user?: { id: string; displayName: string; role: 'admin' | 'member'; avatarUrl: string | null } }>
}

export default function EditUserDialog({ user, onClose, onSaveProfile }: Props) {
  const open = !!user

  return (
    <ProfileDialog
      open={open}
      onOpenChange={(v) => { if (!v) onClose() }}
      mode="admin"
      initial={{
        id: user?.id || '',
        email: user?.email || '',
        displayName: user?.displayName || '',
        role: user?.role || 'member',
        avatarUrl: user?.avatarUrl ?? null,
      }}
      onSubmit={async ({ displayName, avatarFile, role }) => {
        if (!user) return { ok: false, error: 'No user' }
        const fd = new FormData()
        fd.append('userId', user.id)
        fd.append('role', (role || user.role))
        fd.append('displayName', displayName)
        if (avatarFile) fd.append('avatar', avatarFile)
        const res = await onSaveProfile(fd)
        return { ok: res.ok, error: res.error }
      }}
      title="Edit user"
    />
  )
}


