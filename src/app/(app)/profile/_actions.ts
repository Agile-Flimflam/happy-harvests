'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { Database } from '@/lib/database.types';
import { createClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type ProfileFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  profile?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export type PasswordResetState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
};

function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function updateProfileAction(
  prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  try {
    const supabase = await createSupabaseServerClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        message: 'Authentication required',
        errors: { auth: ['Please sign in to update your profile'] },
      };
    }

    const displayName = formData.get('displayName') as string | null;
    const avatarFile = formData.get('avatar') as File | null;

    let newAvatarUrl: string | null = null;

    // Handle avatar upload if file is provided
    if (avatarFile && avatarFile.size > 0) {
      try {
        const ext = avatarFile.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: avatarFile.type || 'image/*',
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path);
        newAvatarUrl = publicData.publicUrl;
      } catch (e: unknown) {
        return {
          message: 'Failed to upload avatar',
          errors: { avatar: [`Avatar upload failed: ${getErrorMessage(e)}`] },
        };
      }
    }

    // Prepare update payload
    const updatePayload: ProfileUpdate = {};

    if (displayName !== null && displayName.trim() !== '') {
      updatePayload.display_name = displayName.trim();
    }

    if (newAvatarUrl !== null) {
      updatePayload.avatar_url = newAvatarUrl;
    }

    // Only update if there are changes
    if (Object.keys(updatePayload).length > 0) {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...updatePayload,
        } as ProfileInsert)
        .select('id, display_name, avatar_url')
        .single();

      if (error) {
        return {
          message: 'Failed to update profile',
          errors: { database: [error.message] },
        };
      }

      revalidatePath('/', 'layout');

      return {
        message: 'Profile updated successfully',
        profile: data,
      };
    }

    return {
      message: 'No changes to save',
    };
  } catch (error: unknown) {
    return {
      message: 'Failed to update profile',
      errors: { general: [getErrorMessage(error)] },
    };
  }
}

export async function resetPasswordAction(
  prevState: PasswordResetState,
  formData: FormData
): Promise<PasswordResetState> {
  try {
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    // Validation
    if (!newPassword || newPassword.length < 6) {
      return {
        message: 'Password validation failed',
        errors: { newPassword: ['Password must be at least 6 characters'] },
      };
    }

    if (newPassword !== confirmPassword) {
      return {
        message: 'Password validation failed',
        errors: { confirmPassword: ['Passwords do not match'] },
      };
    }

    // Use client-side supabase for auth operations
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      return {
        message: 'Failed to reset password',
        errors: { password: [error.message] },
      };
    }

    return {
      message: 'Password reset successfully',
    };
  } catch (error: unknown) {
    return {
      message: 'Failed to reset password',
      errors: { general: [getErrorMessage(error)] },
    };
  }
}
