import { notFound } from 'next/navigation';
import { listUsersWithRolesAction, inviteUserWithRoleAction, ensureAdminUser } from './actions';
import { sanitizeErrorMessage } from '@/lib/sanitize';
import InviteUserDialog from './ui/InviteUserDialog';
import UsersTable from './ui/UsersTable';
import PageHeader from '@/components/page-header';
import PageContent from '@/components/page-content';

export default async function UsersPage() {
  const { ok } = await ensureAdminUser();
  if (!ok) notFound();

  const { users = [], error: rawError } = await listUsersWithRolesAction();
  const safeError = rawError ? sanitizeErrorMessage(rawError) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="User Management"
        action={<InviteUserDialog onInvite={inviteUserWithRoleAction} />}
      />
      <PageContent>
        {safeError ? (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {safeError}
          </div>
        ) : null}
        <UsersTable initialUsers={users} />
      </PageContent>
    </div>
  );
}
