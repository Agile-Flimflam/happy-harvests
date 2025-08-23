'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

type Props = {
  inviteUser: (input: { email: string }) => Promise<{ ok: boolean; error?: string }>
}

export default function InviteUserForm({ inviteUser }: Props) {
  const [email, setEmail] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email) return
    startTransition(async () => {
      const res = await inviteUser({ email })
      if (res.ok) {
        toast.success('Invitation sent')
        setEmail('')
      } else {
        toast.error(res.error || 'Failed to send invitation')
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="invite-email">Invite by email</Label>
        <Input id="invite-email" type="email" placeholder="new.user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={pending} />
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send invite'}</Button>
    </form>
  )
}


