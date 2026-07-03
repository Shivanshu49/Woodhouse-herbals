import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  TicketPercent,
  Boxes,
  Star,
  LayoutTemplate,
  Megaphone,
  BarChart3,
  Truck,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** The 13 admin sections, in sidebar order. Shared with the command palette. */
export const NAV_SECTIONS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Categories', href: '/categories', icon: FolderTree },
  { label: 'Orders', href: '/orders', icon: ShoppingCart },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Coupons', href: '/coupons', icon: TicketPercent },
  { label: 'Inventory', href: '/inventory', icon: Boxes },
  { label: 'Reviews', href: '/reviews', icon: Star },
  { label: 'Content', href: '/content', icon: LayoutTemplate },
  { label: 'Marketing', href: '/marketing', icon: Megaphone },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Shipping', href: '/shipping', icon: Truck },
  { label: 'Settings', href: '/settings', icon: Settings },
];

/** True when `pathname` is within `href` (exact for '/', prefix otherwise). */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
