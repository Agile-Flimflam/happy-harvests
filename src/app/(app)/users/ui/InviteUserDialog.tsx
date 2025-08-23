'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm, type SubmitHandler, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

type Props = {
  onInvite: (input: { email: string; role: 'admin' | 'member' }) => Promise<{ ok: boolean; error?: string }>
}

export default function InviteUserDialog({ onInvite }: Props) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  const InviteUserSchema = z.object({
    email: z.string().email({ message: 'Enter a valid email address' }),
    role: z.enum(['admin', 'member'], { message: 'Select a role' }),
  })
  type InviteUserValues = z.infer<typeof InviteUserSchema>

  const form = useForm<InviteUserValues>({
    resolver: zodResolver(InviteUserSchema) as unknown as Resolver<InviteUserValues>,
    mode: 'onSubmit',
    defaultValues: { email: '', role: 'member' },
  })

  const onSubmit: SubmitHandler<InviteUserValues> = async (values) => {
    try {
      setPending(true)
      const res = await onInvite({ email: values.email, role: values.role })
      if (!res.ok) {
        toast.error(res.error || 'Failed to send invite')
        return
      }
      toast.success('Invitation sent')
      form.reset({ email: '', role: 'member' })
      setOpen(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)}>Invite user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>Send an invitation email and assign a role.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="new.user@example.com" disabled={pending} {...field} />
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send invite'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}


