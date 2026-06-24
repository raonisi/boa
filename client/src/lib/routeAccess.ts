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

/** Active operational roles — unknown values fail closed on nav-restricted routes. */
export const OPERATIONAL_ROLES = [
  "branch_admin",
  "sub_branch_admin",
  "team_leader",
  "member",
] as const;

export type OperationalRole = (typeof OPERATIONAL_ROLES)[number];

export function isKnownOperationalRole(
  role?: string | null
): role is OperationalRole {
  return (
    !!role &&
    (OPERATIONAL_ROLES as readonly string[]).includes(role)
  );
}

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

  const hasExplicitRestrictions = items.some(
    item =>
      item.canAccess != null ||
      (item.roles != null && item.roles.length > 0)
  );
  if (hasExplicitRestrictions && !isKnownOperationalRole(user.role)) {
    return false;
  }

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
