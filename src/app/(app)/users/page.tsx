import { notFound } from 'next/navigation';
import { listUsersWithRolesAction, inviteUserWithRoleAction, ensureAdminUser } from './actions';
import InviteUserDialog from './ui/InviteUserDialog';
import UsersTable from './ui/UsersTable';
import PageHeader from '@/components/page-header';
import PageContent from '@/components/page-content';

export default async function UsersPage() {
  const { ok } = await ensureAdminUser();
  if (!ok) notFound();

  const { users = [], error } = await listUsersWithRolesAction();

  return (
    <div className="space-y-8">
      <PageHeader
        title="User Management"
        action={<InviteUserDialog onInvite={inviteUserWithRoleAction} />}
      />
      <PageContent>
        {error ? (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <UsersTable initialUsers={users} />
      </PageContent>
    </div>
  );
}
