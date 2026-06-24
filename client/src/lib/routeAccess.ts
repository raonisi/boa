import {
  canAccessNavItem,
  mobileMoreNavGroups,
  sidebarNavGroups,
  type NavItem,
} from "@/lib/navigationConfig";

type RouteAccessUser = {
  role?: string | null;
  accountStatus?: string | null;
  permissions?: string[] | null;
};

const navGroupsForRouteAccess = [...sidebarNavGroups, ...mobileMoreNavGroups];

function navItemsForPath(path: string): NavItem[] {
  const items: NavItem[] = [];
  for (const group of navGroupsForRouteAccess) {
    for (const item of group.items) {
      if (item.path === path) items.push(item);
    }
  }
  return items;
}

/**
 * Navigation-aligned route access for general management screens.
 * AuthGuard must run first (session + active account).
 */
export function canAccessRoutePath(
  path: string,
  user: RouteAccessUser | null | undefined
): boolean {
  if (!user || user.accountStatus !== "active") return false;

  const items = navItemsForPath(path);
  if (items.length === 0) return true;

  return items.some(item => canAccessNavItem(item, user));
}

export function getRouteAccessRoles(path: string): string[] | null {
  const items = navItemsForPath(path);
  if (items.length === 0) return null;

  const roles = new Set<string>();
  for (const item of items) {
    if (item.canAccess) continue;
    if (!item.roles) return null;
    for (const role of item.roles) roles.add(role);
  }
  return roles.size > 0 ? Array.from(roles) : null;
}
