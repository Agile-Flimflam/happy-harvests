import type { Enums, Tables } from "@/lib/supabase-server";

export type UserRole = Enums<"user_role">;

export function hasRole(
  profile: Pick<Tables<"profiles">, "role"> | null | undefined,
  role: UserRole
): boolean {
  return (profile?.role ?? null) === role;
}

export function isAdmin(profile: Pick<Tables<"profiles">, "role"> | null | undefined): boolean {
  return hasRole(profile, "admin");
}
