'use server';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUserAndProfile } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/authz';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

export async function inviteUserAction(input: { email: string }) {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { ok: false, error: 'Unauthorized' };
  }

  const admin = createSupabaseAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:4000';
  const redirectTo = `${siteUrl}/auth/update-password`;
  try {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, { redirectTo });
    if (error) return { ok: false, error: error.message };
    return { ok: true, userId: data?.user?.id };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, error: message };
  }
}

export async function inviteUserWithRoleAction(input: { email: string; role: 'admin' | 'member' }) {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { ok: false, error: 'Unauthorized' };
  }
  const admin = createSupabaseAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:4000';
  const redirectTo = `${siteUrl}/auth/update-password`;
  try {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, { redirectTo });
    if (error) return { ok: false, error: error.message };
    const userId = data.user?.id;
    if (userId) {
      const { error: roleErr } = await admin
        .from('profiles')
        .update({ role: input.role })
        .eq('id', userId);
      if (roleErr) return { ok: false, error: roleErr.message };
    }
    return { ok: true, userId };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, error: message };
  }
}

export async function listUsersAction() {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) return { users: [], error: 'Unauthorized' };

  const admin = createSupabaseAdminClient();
  const { data, error: listError } = await admin.auth.admin.listUsers();
  if (listError) return { users: [], error: listError.message };
  return { users: data.users };
}

export async function ensureAdminUser(): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !profile || !isAdmin(profile)) {
    return { ok: false, error: 'Unauthorized' };
  }
  return { ok: true, userId: user.id };
}

export type ListedUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  role: 'admin' | 'member';
  avatarUrl: string | null;
};

export async function listUsersWithRolesAction(): Promise<{ users: ListedUser[]; error?: string }> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) return { users: [], error: 'Unauthorized' };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) return { users: [], error: error.message };
  const authUsers = Array.isArray(data?.users) ? data.users : [];
  const ids = authUsers.map((u) => u.id).filter(Boolean) as string[];
  if (ids.length === 0) return { users: [] };
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, role, display_name, full_name, avatar_url')
    .in('id', ids);
  if (profilesError) return { users: [], error: profilesError.message };
  type ProfileRow = {
    id: string;
    role: 'admin' | 'member';
    display_name: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  const invalidRoleIds: string[] = [];
  const profileRows: ProfileRow[] = Array.isArray(profiles)
    ? profiles.map((p) => {
        const isValidRole = p.role === 'admin' || p.role === 'member';
        if (!isValidRole) {
          invalidRoleIds.push(p.id);
        }
        return {
          id: p.id,
          role: isValidRole ? p.role : 'member',
          display_name: p.display_name ?? null,
          full_name: p.full_name ?? null,
          avatar_url: p.avatar_url ?? null,
        };
      })
    : [];
  const idToProfile = new Map<string, ProfileRow>(profileRows.map((p) => [p.id, p]));
  const users: ListedUser[] = authUsers.map((u) => ({
    id: u.id,
    email: u.email || '',
    displayName: (() => {
      const p = idToProfile.get(u.id);
      const fallback = (u.email || '').split('@')[0] || '';
      return p?.display_name || p?.full_name || fallback;
    })(),
    createdAt: typeof u.created_at === 'string' ? u.created_at : '',
    role: idToProfile.get(u.id)?.role || 'member',
    avatarUrl: idToProfile.get(u.id)?.avatar_url ?? null,
  }));
  const invalidRoleError =
    invalidRoleIds.length > 0
      ? `Invalid role values found for profile ids: ${invalidRoleIds.join(', ')} (defaulted to member)`
      : undefined;
  return { users, error: invalidRoleError };
}

export async function updateUserRoleAction(input: {
  userId: string;
  role: 'admin' | 'member';
}): Promise<{ ok: boolean; error?: string }> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) return { ok: false, error: 'Unauthorized' };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ role: input.role })
    .eq('id', input.userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateUserProfileAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  user?: { id: string; displayName: string; role: 'admin' | 'member'; avatarUrl: string | null };
}> {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { ok: false, error: 'Unauthorized' };
  }

  const admin = createSupabaseAdminClient();
  const userId = String(formData.get('userId') || '');
  const roleRaw = formData.get('role');
  const roleInput = typeof roleRaw === 'string' ? roleRaw.toLowerCase() : '';
  if (roleInput !== 'admin' && roleInput !== 'member') {
    return { ok: false, error: 'Invalid role' };
  }
  const role: 'admin' | 'member' = roleInput;
  const displayName = String(formData.get('displayName') || '');
  const file = formData.get('avatar') as File | null;
  if (!userId) return { ok: false, error: 'Missing userId' };

  let avatarUrl: string | null = null;
  try {
    if (file && file instanceof File && file.size > 0) {
      if (file.size > MAX_AVATAR_BYTES) {
        return { ok: false, error: 'Avatar must be 5MB or smaller' };
      }
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const;
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const isAllowedExt = allowedExtensions.includes(ext as (typeof allowedExtensions)[number]);
      const isImageType = typeof file.type === 'string' && file.type.startsWith('image/');
      if (!isAllowedExt || !isImageType) {
        return {
          ok: false,
          error: 'Avatar must be an image of type jpg, jpeg, png, gif, or webp',
        };
      }
      const contentType = file.type || `image/${ext || 'jpeg'}`;
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await admin.storage.from('avatars').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType,
      });
      if (upErr) return { ok: false, error: upErr.message };
      const { data: pub } = admin.storage.from('avatars').getPublicUrl(path);
      avatarUrl = pub.publicUrl;
    }

    const updatePayload: {
      role: 'admin' | 'member';
      display_name?: string;
      avatar_url?: string | null;
    } = { role };
    if (displayName) updatePayload.display_name = displayName;
    if (avatarUrl !== null) updatePayload.avatar_url = avatarUrl;

    const { error: updErr } = await admin.from('profiles').update(updatePayload).eq('id', userId);
    if (updErr) return { ok: false, error: updErr.message };

    return { ok: true, user: { id: userId, displayName, role, avatarUrl } };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, error: message };
  }
}
