'use server'

import { createSupabaseAdminClient } from '@/lib/supabase-admin'

export async function inviteUserAction(input: { email: string }) {
  const admin = createSupabaseAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:4000'
  const redirectTo = `${siteUrl}/auth/update-password`
  try {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, { redirectTo })
    if (error) return { ok: false, error: error.message }
    return { ok: true, userId: data?.user?.id }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { ok: false, error: message }
  }
}

export async function inviteUserWithRoleAction(input: { email: string; role: 'admin' | 'member' }) {
  const admin = createSupabaseAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:4000'
  const redirectTo = `${siteUrl}/auth/update-password`
  try {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, { redirectTo })
    if (error) return { ok: false, error: error.message }
    const userId = data.user?.id
    if (userId) {
      const { error: roleErr } = await admin.from('profiles').update({ role: input.role }).eq('id', userId)
      if (roleErr) return { ok: false, error: roleErr.message }
    }
    return { ok: true, userId }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { ok: false, error: message }
  }
}

export async function listUsersAction() {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) return { users: [], error: error.message }
  return { users: data.users }
}

export type ListedUser = {
  id: string
  email: string
  displayName: string
  createdAt: string
  role: 'admin' | 'member'
  avatarUrl: string | null
}

export async function listUsersWithRolesAction(): Promise<{ users: ListedUser[]; error?: string }> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) return { users: [], error: error.message }
  const authUsers = data.users
  const ids = authUsers.map((u) => u.id).filter(Boolean) as string[]
  if (ids.length === 0) return { users: [] }
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, role, display_name, full_name, avatar_url')
    .in('id', ids)
  if (profilesError) return { users: [], error: profilesError.message }
  type ProfileRow = { id: string; role: 'admin' | 'member'; display_name: string | null; full_name: string | null; avatar_url: string | null }
  const idToProfile = new Map<string, ProfileRow>(
    (profiles as ProfileRow[]).map((p) => [p.id, p])
  )
  const users: ListedUser[] = authUsers.map((u) => ({
    id: u.id,
    email: u.email || '',
    displayName: (() => {
      const p = idToProfile.get(u.id)
      const fallback = (u.email || '').split('@')[0] || ''
      return p?.display_name || p?.full_name || fallback
    })(),
    createdAt: u.created_at as unknown as string,
    role: (idToProfile.get(u.id)?.role) || 'member',
    avatarUrl: idToProfile.get(u.id)?.avatar_url ?? null,
  }))
  return { users }
}

export async function updateUserRoleAction(input: { userId: string; role: 'admin' | 'member' }): Promise<{ ok: boolean; error?: string }>
{
  const admin = createSupabaseAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ role: input.role })
    .eq('id', input.userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function updateUserProfileAction(formData: FormData): Promise<{ ok: boolean; error?: string; user?: { id: string; displayName: string; role: 'admin' | 'member'; avatarUrl: string | null } }> {
  const admin = createSupabaseAdminClient()
  const userId = String(formData.get('userId') || '')
  const role = (String(formData.get('role') || 'member') as 'admin' | 'member')
  const displayName = String(formData.get('displayName') || '')
  const file = formData.get('avatar') as File | null
  if (!userId) return { ok: false, error: 'Missing userId' }

  let avatarUrl: string | null = null
  try {
    if (file && file instanceof File && file.size > 0) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${userId}/${Date.now()}.${ext}`
      const { error: upErr } = await admin.storage
        .from('avatars')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'image/*',
        })
      if (upErr) return { ok: false, error: upErr.message }
      const { data: pub } = admin.storage.from('avatars').getPublicUrl(path)
      avatarUrl = pub.publicUrl
    }

    const updatePayload: Record<string, unknown> = { role }
    if (displayName) updatePayload.display_name = displayName
    if (avatarUrl !== null) updatePayload.avatar_url = avatarUrl

    const { error: updErr } = await admin.from('profiles').update(updatePayload).eq('id', userId)
    if (updErr) return { ok: false, error: updErr.message }

    return { ok: true, user: { id: userId, displayName, role, avatarUrl } }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { ok: false, error: message }
  }
}


