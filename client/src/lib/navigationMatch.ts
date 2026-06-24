import type { NavGroup, NavItem } from "@/lib/navigationConfig";

export function normalizeNavPath(location: string): string {
  return (location.split("?")[0]?.split("#")[0] ?? location).trim() || "/";
}

/**
 * Longest-prefix wins. Parent paths like /customers do not steal
 * /customers/assign; dynamic /customers/:id maps to 고객 관리.
 */
export function getNavMatchScore(itemPath: string, pathOnly: string): number {
  if (itemPath === "/") {
    return pathOnly === "/" ? 10_000 : 0;
  }

  if (pathOnly === itemPath) {
    return itemPath.length + 1_000;
  }

  if (!pathOnly.startsWith(`${itemPath}/`)) {
    return 0;
  }

  if (itemPath === "/customers") {
    return /^\/customers\/\d+(?:\/|$)/.test(pathOnly)
      ? itemPath.length + 500
      : 0;
  }

  return itemPath.length;
}

export function isNavItemActive(itemPath: string, location: string): boolean {
  const pathOnly = normalizeNavPath(location);
  const score = getNavMatchScore(itemPath, pathOnly);
  if (score === 0) return false;

  // Defer to resolveActiveNavItem when comparing siblings.
  return score > 0;
}

export function resolveActiveNavItem(
  groups: NavGroup[],
  location: string
): { groupLabel: string; item: NavItem; score: number } | null {
  const pathOnly = normalizeNavPath(location);
  let best: { groupLabel: string; item: NavItem; score: number } | null = null;

  for (const group of groups) {
    for (const item of group.items) {
      const score = getNavMatchScore(item.path, pathOnly);
      if (score > 0 && (!best || score > best.score)) {
        best = { groupLabel: group.label, item, score };
      }
    }
  }

  return best;
}

export function isNavGroupActive(
  group: NavGroup,
  location: string,
  groups: NavGroup[]
): boolean {
  const active = resolveActiveNavItem(groups, location);
  return active?.groupLabel === group.label;
}

export type NavigationBreadcrumb = {
  groupLabel: string | null;
  pageTitle: string;
};

export function getNavigationBreadcrumb(
  location: string,
  groups: NavGroup[],
  pageTitle: string
): NavigationBreadcrumb {
  const active = resolveActiveNavItem(groups, location);
  return {
    groupLabel: active?.groupLabel ?? null,
    pageTitle,
  };
}
