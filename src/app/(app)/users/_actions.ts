'use server';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUserAndProfile } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/authz';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

const VALID_ROLES = ['admin', 'member'] as const;
type UserRole = (typeof VALID_ROLES)[number];

function isUserRole(value: string): value is UserRole {
  return (VALID_ROLES as readonly string[]).includes(value);
}

type DetectedImage =
  | { ext: 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp'; mime: string }
  | { error: string };

async function detectImageType(file: File): Promise<DetectedImage> {
  const declaredType = typeof file.type === 'string' ? file.type.trim().toLowerCase() : '';
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  // Explicitly disallow SVG to avoid embedded script/XSS vectors in avatars
  const isLikelySvg = (() => {
    const text = String.fromCharCode(...head)
      .trimStart()
      .toLowerCase();
    return text.startsWith('<svg') || text.startsWith('<?xml');
  })();
  if (declaredType === 'image/svg+xml' || isLikelySvg) {
    return { error: 'SVG avatars are not allowed due to XSS risk' };
  }

  const isPng =
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a;
  if (isPng) {
    const allowedDeclared = declaredType ? ['image/png'] : null;
    if (allowedDeclared && !allowedDeclared.includes(declaredType)) {
      return { error: 'Avatar file type does not match the detected PNG content' };
    }
    return { ext: 'png', mime: 'image/png' };
  }

  const isJpeg = head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (isJpeg) {
    const allowedDeclared = declaredType ? ['image/jpeg', 'image/jpg'] : null;
    if (allowedDeclared && !allowedDeclared.includes(declaredType)) {
      return { error: 'Avatar file type does not match the detected JPEG content' };
    }
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  const isGif =
    head.length >= 6 &&
    head[0] === 0x47 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x38 &&
    (head[4] === 0x39 || head[4] === 0x37) &&
    head[5] === 0x61;
  if (isGif) {
    const allowedDeclared = declaredType ? ['image/gif'] : null;
    if (allowedDeclared && !allowedDeclared.includes(declaredType)) {
      return { error: 'Avatar file type does not match the detected GIF content' };
    }
    return { ext: 'gif', mime: 'image/gif' };
  }

  const isWebp =
    head.length >= 12 &&
    head[0] === 0x52 && // R
    head[1] === 0x49 && // I
    head[2] === 0x46 && // F
    head[3] === 0x46 && // F
    head[8] === 0x57 && // W
    head[9] === 0x45 && // E
    head[10] === 0x42 && // B
    head[11] === 0x50; // P
  if (isWebp) {
    const allowedDeclared = declaredType ? ['image/webp'] : null;
    if (allowedDeclared && !allowedDeclared.includes(declaredType)) {
      return { error: 'Avatar file type does not match the detected WEBP content' };
    }
    return { ext: 'webp', mime: 'image/webp' };
  }

  return { error: 'Avatar must be a valid PNG, JPEG, GIF, or WEBP image' };
}

export async function inviteUserAction(input: { email: string }) {
  const { user, profile } = await getUserAndProfile();
  if (!user || !isAdmin(profile)) {
    return { ok: false, error: 'Unauthorized' };
  }

  const admin = createSupabaseAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) {
    return { ok: false, error: 'Site URL is not configured for invitations.' };
  }
  const redirectTo = `${siteUrl}/auth/update-password`;
  try {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, { redirectTo });
    if (error) return { ok: false, error: error.message };
    const userId = data?.user?.id;
    if (!userId) {
      return { ok: false, error: 'Invitation succeeded but user id was not returned.' };
    }
    return { ok: true, userId };
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) {
    return { ok: false, error: 'Site URL is not configured for invitations.' };
  }
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

export async function listUsersWithRolesAction(): Promise<{
  users: ListedUser[];
  error?: string;
  warning?: string;
}> {
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
  const fallbackCreatedAtIso = new Date(0).toISOString();
  const users: ListedUser[] = authUsers.map((u) => ({
    id: u.id,
    email: u.email || '',
    displayName: (() => {
      const p = idToProfile.get(u.id);
      const fallback = (u.email || '').split('@')[0] || '';
      return p?.display_name || p?.full_name || fallback;
    })(),
    createdAt: typeof u.created_at === 'string' ? u.created_at : fallbackCreatedAtIso,
    role: idToProfile.get(u.id)?.role || 'member',
    avatarUrl: idToProfile.get(u.id)?.avatar_url ?? null,
  }));
  const invalidRoleWarning =
    invalidRoleIds.length > 0
      ? `Invalid role values found for profile ids: ${invalidRoleIds.join(
          ', '
        )} (defaulted to member)`
      : undefined;
  return { users, warning: invalidRoleWarning };
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
  if (!isUserRole(roleInput)) {
    return { ok: false, error: 'Invalid role. Must be either "admin" or "member".' };
  }
  const role = roleInput as UserRole;
  const displayName = String(formData.get('displayName') || '');
  const avatarEntry = formData.get('avatar');
  if (typeof avatarEntry === 'string') {
    return { ok: false, error: 'Avatar must be an uploaded image file' };
  }
  let file: File | null = null;
  if (avatarEntry instanceof File) {
    if (avatarEntry.size === 0) {
      return { ok: false, error: 'Avatar file is empty; please choose an image' };
    }
    file = avatarEntry;
  }
  if (!userId) return { ok: false, error: 'Missing userId' };

  let avatarUrl: string | null = null;
  try {
    if (file && file instanceof File && file.size > 0) {
      if (file.size > MAX_AVATAR_BYTES) {
        return { ok: false, error: 'Avatar must be 5MB or smaller' };
      }
      const detected = await detectImageType(file);
      if ('error' in detected) {
        return { ok: false, error: detected.error };
      }
      const { ext, mime } = detected;
      const contentType = mime;
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
