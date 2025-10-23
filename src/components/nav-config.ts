import { Home, Leaf, Fence, Sprout, MapPin, Users, Blocks, FlaskConical, Droplets, Calendar, Package, Contact } from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const OVERVIEW_GROUP: NavGroup = {
  label: "Overview",
  items: [
    { label: "Dashboard", href: "/", icon: Home },
  ],
}

export const WORK_GROUP: NavGroup = {
  label: "Work",
  items: [
    { label: "Plantings", href: "/plantings", icon: Sprout },
    { label: "Activities", href: "/activities", icon: Droplets },
    { label: "Calendar", href: "/calendar", icon: Calendar },
    { label: "Seeds", href: "/seeds", icon: Package },
    { label: "Customers", href: "/customers", icon: Contact },
    { label: "Deliveries", href: "/deliveries", icon: Package },
  ],
}

export const SETUP_GROUP: NavGroup = {
  label: "Setup",
  items: [
    { label: "Locations", href: "/locations", icon: MapPin },
    { label: "Plots & Beds", href: "/plots", icon: Fence },
    { label: "Nurseries", href: "/nurseries", icon: FlaskConical },
    { label: "Crop Varieties", href: "/crop-varieties", icon: Leaf },
  ],
}

export const ADMIN_GROUP: NavGroup = {
  label: "Admin",
  items: [
    { label: "Users", href: "/users", icon: Users },
    { label: "Integrations", href: "/settings/integrations", icon: Blocks },
  ],
}

export const NAV_GROUPS: NavGroup[] = [OVERVIEW_GROUP, WORK_GROUP, SETUP_GROUP, ADMIN_GROUP]
