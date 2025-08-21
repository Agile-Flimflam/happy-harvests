'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils'; // Assuming shadcn/ui setup
import { Home, Leaf, Fence, Sprout } from 'lucide-react'; // Icons (removed Tractor)

const links = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Crop Varieties', href: '/crop-varieties', icon: Leaf },
  { name: 'Plots & Beds', href: '/plots', icon: Fence },
  { name: 'Crops', href: '/crops', icon: Sprout },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-2">
      {links.map((link) => {
        const LinkIcon = link.icon;
        return (
          <Link
            key={link.name}
            href={link.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50',
              {
                'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50': pathname === link.href,
              }
            )}
          >
            <LinkIcon className="h-4 w-4" />
            {link.name}
          </Link>
        );
      })}
    </nav>
  );
} 