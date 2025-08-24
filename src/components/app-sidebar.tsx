"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { User } from "@supabase/supabase-js"

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
} from "@/components/ui/sidebar"
import { UserAccountMenu } from "@/components/user-account-menu"
import type { Tables } from "@/lib/supabase-server"
import { isAdmin } from "@/lib/authz"
import { NAV_GROUPS } from "@/components/nav-config"
import { useSidebar } from "@/components/ui/sidebar"

type AppSidebarProps = {
  initialUser: User | null
  initialProfile: (
    Pick<
      Tables<'profiles'>,
      'id' | 'display_name' | 'full_name' | 'avatar_url' | 'role'
    >
  ) | null
}

export function AppSidebar({ initialUser, initialProfile }: AppSidebarProps) {
  const pathname = usePathname()
  const showAdmin = isAdmin(initialProfile)
  const { isMobile, setOpenMobile } = useSidebar()

  const handleNavClick = React.useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  return (
    <>
      <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarContent>
        {NAV_GROUPS.filter((group) => group.label !== "Admin" || showAdmin).map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label} onClick={handleNavClick}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserAccountMenu initialUser={initialUser} initialProfile={initialProfile} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
    </>
  )
}