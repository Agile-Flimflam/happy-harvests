import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { listUsersWithRolesAction, inviteUserWithRoleAction } from './_actions'
import InviteUserDialog from './ui/InviteUserDialog'
import UsersTable from './ui/UsersTable'
import PageHeader from '@/components/page-header'
import PageContent from '@/components/page-content'

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
      <PageHeader
        title="User Management"
        action={<InviteUserDialog onInvite={inviteUserWithRoleAction} />}
      />
      <PageContent>
        <UsersTable initialUsers={users} />
      </PageContent>
    </div>
  )
}
