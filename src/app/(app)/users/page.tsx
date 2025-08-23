import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { listUsersWithRolesAction, inviteUserWithRoleAction } from './_actions'
import InviteUserDialog from './ui/InviteUserDialog'
import UsersTable from './ui/UsersTable'

export default async function UsersPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    notFound()
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    notFound()
  }

  const { users = [] } = await listUsersWithRolesAction()

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">User management</h1>
      <InviteUserDialog onInvite={inviteUserWithRoleAction} />
      <div className="space-y-2">
        <UsersTable initialUsers={users} />
      </div>
    </div>
  )
}

// client button moved to ./ui/InviteUserButton


