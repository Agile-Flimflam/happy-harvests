-- Seed data for local development
-- This file runs after migrations during `supabase db reset`.

-- Create the first admin user
-- We'll use a fixed UUID for consistency and create both the auth user and profile

-- First, create the auth user
INSERT INTO auth.users
    (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
    )
VALUES
    (
        '00000000-0000-0000-0000-000000000000',
        '11111111-1111-1111-1111-111111111111',
        'authenticated',
        'authenticated',
        'admin@happylaufarms.com',
        crypt('admin123', gen_salt('bf')),
        NOW(),
        NULL,
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "Admin User", "display_name": "Admin"}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
)
ON CONFLICT
(id) DO NOTHING;

-- Create the profile for the admin user with admin role
INSERT INTO profiles
    (
    id,
    full_name,
    display_name,
    avatar_url,
    locale,
    timezone,
    role,
    created_at,
    updated_at
    )
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'Admin User',
        'Admin',
        NULL,
        'en',
        'UTC',
        'admin',
        NOW(),
        NOW()
)
ON CONFLICT
(id) DO
UPDATE SET
  role = 'admin',
  full_name = 'Admin User',
  display_name = 'Admin',
  updated_at = NOW();