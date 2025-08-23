'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type Props = {
  user: { id: string; email: string; displayName: string; role: 'admin' | 'member'; avatarUrl?: string | null } | null
  onClose: () => void
  onSaveProfile: (formData: FormData) => Promise<{ ok: boolean; error?: string; user?: { id: string; displayName: string; role: 'admin' | 'member'; avatarUrl: string | null } }>
}

export default function EditUserDialog({ user, onClose, onSaveProfile }: Props) {
  const open = !!user
  const [pending, setPending] = React.useState(false)

  const EditUserSchema = z.object({
    userId: z.string().min(1),
    displayName: z.string().min(1, { message: 'Display name is required' }).max(100, { message: 'Max 100 characters' }),
    role: z.enum(['admin', 'member'], { message: 'Select a role' }),
    // avatar is handled via input element; validation server-side as needed
  })
  type EditUserValues = z.infer<typeof EditUserSchema>

  const form = useForm<EditUserValues>({
    resolver: zodResolver(EditUserSchema) as unknown as Resolver<EditUserValues>,
    mode: 'onSubmit',
    values: user ? { userId: user.id, displayName: user.displayName, role: user.role } : { userId: '', displayName: '', role: 'member' },
  })

  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)

  const onSubmit: SubmitHandler<EditUserValues> = async (values) => {
    if (!user) return
    try {
      setPending(true)
      const fd = new FormData()
      fd.append('userId', values.userId)
      fd.append('role', values.role)
      fd.append('displayName', values.displayName)
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
          <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-10 ring-1 ring-border">
                <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName} />
                <AvatarFallback>{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <FormLabel>Email</FormLabel>
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </div>
            </div>
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input placeholder="Display name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">member</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <FormLabel htmlFor="avatar">Avatar</FormLabel>
              <Input id="avatar" type="file" accept="image/png,image/jpeg,image/jpg" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</Button>
            </DialogFooter>
          </form>
          </Form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}


