import { redirect } from 'next/navigation';
import { getUserAndProfile } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/authz';
import { IntegrationsPageContent } from './_components/IntegrationsPageContent';

export default async function IntegrationsPage() {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    redirect('/');
  }
  return <IntegrationsPageContent />;
}


