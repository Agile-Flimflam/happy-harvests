"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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

export function UserAccountMenu({ initialUser, initialProfile }: UserAccountMenuProps) {
  const router = useRouter()
  const [user] = React.useState<User | null>(initialUser)
  const [profile, setProfile] = React.useState<Profile | null>(initialProfile)
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = React.useState(false)
  const [avatarUploading, setAvatarUploading] = React.useState(false)
  const [profileSaving, setProfileSaving] = React.useState(false)
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

  function getErrorMessage(error: unknown, fallback = "Failed to update profile"): string {
    if (error instanceof Error) return error.message
    return fallback
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

  async function handleSaveProfile() {
    if (!user) return
    const supabase = createClient()
    try {
      setProfileSaving(true)
      let newAvatarUrl: string | null = profile?.avatar_url || null
      if (selectedFile) {
        setAvatarUploading(true)
        try {
          const ext = selectedFile.name.split(".").pop() || "jpg"
          const path = `${user.id}/${Date.now()}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(path, selectedFile, { cacheControl: "3600", upsert: false, contentType: selectedFile.type || "image/*" })
          if (uploadError) throw uploadError
          const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path)
          newAvatarUrl = publicData.publicUrl
        } catch (e: unknown) {
          console.error("Avatar upload failed:", e)
          throw new Error(`Avatar upload failed: ${getErrorMessage(e, "Unknown error")}`)
        } finally {
          setAvatarUploading(false)
        }
      }

      const name = nameInput.trim() || null
      const upsertPayload: Partial<Profile> & { id: string } = { id: user.id }
      if (name !== (profile?.display_name || null)) upsertPayload.display_name = name
      if (newAvatarUrl !== (profile?.avatar_url || null)) upsertPayload.avatar_url = newAvatarUrl

      if (Object.keys(upsertPayload).length > 1) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .upsert(upsertPayload)
            .select()
            .single()
          if (error) throw error
          setProfile((prev) => ({ ...(prev || { id: user.id, display_name: null, full_name: null, avatar_url: null }), display_name: data?.display_name ?? name, avatar_url: data?.avatar_url ?? newAvatarUrl ?? null }))
        } catch (e: unknown) {
          console.error("Profile upsert failed:", e)
          throw new Error(`Profile update failed: ${getErrorMessage(e, "Unknown error")}`)
        }
      }
      toast.success("Profile updated")
      setProfileDialogOpen(false)
      setSelectedFile(null)
      setPreviewUrl(null)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setProfileSaving(false)
      setAvatarUploading(false)
    }
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
            onSubmit={(e) => { e.preventDefault(); void handleSaveProfile() }}
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
              <Input id="displayName" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Your name" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProfileDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={profileSaving || avatarUploading}>
                {profileSaving || avatarUploading ? "Saving..." : "Save"}
              </Button>
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
          <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
