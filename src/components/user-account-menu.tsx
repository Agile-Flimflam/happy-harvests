"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import type { User } from "@supabase/supabase-js"
import { ChevronUp } from "lucide-react"

import { SidebarMenuButton } from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase"
import { toast } from "sonner"
import { updateProfileAction, resetPasswordAction } from "@/app/(app)/profile/_actions"
import ProfileDialog from "@/components/users/ProfileDialog"

type Profile = {
  id: string
  display_name: string | null
  full_name: string | null
  avatar_url: string | null
}

export type UserAccountMenuProps = {
  initialUser: User | null
  initialProfile: Profile | null
}

function SubmitButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus()
  return (
    <Button {...props} disabled={pending || props.disabled}>
      {pending ? "Saving..." : children}
    </Button>
  )
}

export function UserAccountMenu({ initialUser, initialProfile }: UserAccountMenuProps) {
  const router = useRouter()
  const [user] = React.useState<User | null>(initialUser)
  const [profile, setProfile] = React.useState<Profile | null>(initialProfile)
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = React.useState(false)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = React.useState(false)
  // Handle profile submit via shared dialog (self mode)
  async function handleProfileDialogSubmit(values: { displayName: string; avatarFile: File | null }) {
    const formData = new FormData()
    formData.set('displayName', values.displayName)
    if (values.avatarFile) formData.set('avatar', values.avatarFile)

    const result = await updateProfileAction({ message: "" }, formData)
    if (result.errors) {
      const errorMessages = Object.values(result.errors).flat().filter(Boolean)
      if (errorMessages.length > 0) {
        toast.error(errorMessages[0])
      }
      return { ok: false, error: 'Validation error' }
    }

    if (result.profile) {
      setProfile(prev => ({
        ...prev,
        id: result.profile!.id,
        display_name: result.profile!.display_name,
        full_name: prev?.full_name || null,
        avatar_url: result.profile!.avatar_url
      }))
    }
    toast.success(result.message)
    return { ok: true }
  }

  async function handlePasswordSubmit(formData: FormData) {
    const result = await resetPasswordAction({ message: "" }, formData)
    
    if (result.errors) {
      const errorMessages = Object.values(result.errors).flat().filter(Boolean)
      if (errorMessages.length > 0) {
        toast.error(errorMessages[0])
      }
      return
    }

    toast.success(result.message)
    setResetPasswordDialogOpen(false)
  }

  type UserMetadata = {
    full_name?: string
    avatar_url?: string
  }
  const metadata = (user?.user_metadata as UserMetadata | undefined)
  const displayName = profile?.display_name || profile?.full_name || metadata?.full_name || user?.email?.split("@")[0] || "Account"
  const email = user?.email || ""
  const avatarUrl = profile?.avatar_url || metadata?.avatar_url

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }



  return (
    <>
      <ProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        mode="self"
        initial={{
          id: user?.id || '',
          email,
          displayName,
          role: 'member',
          avatarUrl: avatarUrl || null,
        }}
        onSubmit={handleProfileDialogSubmit}
      />

      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Reset your account password.</DialogDescription>
          </DialogHeader>
          <form
            action={handlePasswordSubmit}
            className="flex flex-col gap-6"
          >
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input 
                id="newPassword" 
                name="newPassword"
                type="password" 
                placeholder="New password" 
                required 
              />
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input 
                id="confirmPassword" 
                name="confirmPassword"
                type="password" 
                placeholder="Confirm new password" 
                required 
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
                Cancel
              </Button>
              <SubmitButton type="submit">
                Reset password
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DropdownMenu open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size="lg">
            <Avatar>
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span>{displayName}</span>
            <ChevronUp className="ml-auto" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-[--radix-popper-anchor-width]">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-none">{displayName}</span>
              {email ? <span className="text-xs text-muted-foreground">{email}</span> : null}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAccountMenuOpen(false); setProfileDialogOpen(true) }}>Manage profile</DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAccountMenuOpen(false); setResetPasswordDialogOpen(true) }}>Reset password</DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
