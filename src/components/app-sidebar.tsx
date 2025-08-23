"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { Home, Leaf, Fence, Sprout, MapPin, Users } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { UserAccountMenu } from "@/components/user-account-menu"

type AppSidebarProps = {
  initialUser: User | null
  initialProfile: {
    id: string
    display_name: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

export function AppSidebar({ initialUser, initialProfile }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
      <SidebarContent className="gap-1">
        <SidebarGroup className="p-1">
          <SidebarGroupLabel className="h-7">Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Dashboard">
                  <Link href="/">
                    <Home />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="p-1">
          <SidebarGroupLabel className="h-7">Work</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/plantings"} tooltip="Plantings">
                  <Link href="/plantings">
                    <Sprout />
                    <span>Plantings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="p-1">
          <SidebarGroupLabel className="h-7">Setup</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/locations"} tooltip="Locations">
                  <Link href="/locations">
                    <MapPin />
                    <span>Locations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/plots"} tooltip="Plots & Beds">
                  <Link href="/plots">
                    <Fence />
                    <span>Plots & Beds</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/crop-varieties"} tooltip="Crop Varieties">
                  <Link href="/crop-varieties">
                    <Leaf />
                    <span>Crop Varieties</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="p-1">
          <SidebarGroupLabel className="h-7">Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/users"} tooltip="Users">
                  <Link href="/users">
                    <Users />
                    <span>Users</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserAccountMenu initialUser={initialUser} initialProfile={initialProfile} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
    </>
  )
}