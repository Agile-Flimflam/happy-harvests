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
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [nameInput, setNameInput] = React.useState<string>(
    (initialProfile?.display_name || initialProfile?.full_name) ?? ""
  )

  React.useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  // Handle form submissions with direct async functions
  async function handleProfileSubmit(formData: FormData) {
    const result = await updateProfileAction({ message: "" }, formData)
    
    if (result.errors) {
      const errorMessages = Object.values(result.errors).flat().filter(Boolean)
      if (errorMessages.length > 0) {
        toast.error(errorMessages[0])
      }
      return
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
    setProfileDialogOpen(false)
    setSelectedFile(null)
    setPreviewUrl(null)
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
      <Dialog open={profileDialogOpen} onOpenChange={(open) => { setProfileDialogOpen(open); if (open) { setNameInput(profile?.display_name || profile?.full_name || ""); setPreviewUrl(null); setSelectedFile(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage profile</DialogTitle>
            <DialogDescription>Update your display name and avatar.</DialogDescription>
          </DialogHeader>
          <form
            action={async (formData) => {
              formData.set('displayName', nameInput)
              if (selectedFile) {
                formData.set('avatar', selectedFile)
              }
              await handleProfileSubmit(formData)
            }}
            className="flex flex-col gap-6"
          >
            <div className="flex items-center gap-4">
              <Avatar className="size-16 ring-1 ring-border">
                <AvatarImage src={previewUrl || avatarUrl} alt={displayName} />
                <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="avatar">Avatar</Label>
                <Input
                  id="avatar"
                  name="avatar"
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">PNG or JPEG up to 5MB. Recommended square image.</p>
              </div>
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input 
                id="displayName" 
                name="displayName"
                value={nameInput} 
                onChange={(e) => setNameInput(e.target.value)} 
                placeholder="Your name" 
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProfileDialogOpen(false)}>
                Cancel
              </Button>
              <SubmitButton type="submit">
                Save
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
