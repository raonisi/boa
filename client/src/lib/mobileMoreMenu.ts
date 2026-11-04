import type { NavGroup, NavItem } from "@/lib/navigationConfig";

export interface SearchableMenuItem extends NavItem {
  groupLabel?: string;
}

/**
 * Normalizes text for robust Korean/English search:
 * - trims whitespace
 * - converts to lowercase
 * - removes redundant spaces
 */
export function normalizeSearchTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Searches items accessible to the current user across groups and quick links.
 * Returns deduplicated items matching either label or description.
 */
export function searchNavItems(
  groups: NavGroup[],
  quickLinks: NavItem[] = [],
  query: string
): SearchableMenuItem[] {
  const normalized = normalizeSearchTerm(query);
  if (!normalized) return [];

  const seenPaths = new Set<string>();
  const results: SearchableMenuItem[] = [];

  // Helper to match an item
  const matches = (item: NavItem) => {
    const labelMatch = normalizeSearchTerm(item.label).includes(normalized);
    const descMatch = item.description
      ? normalizeSearchTerm(item.description).includes(normalized)
      : false;
    return labelMatch || descMatch;
  };

  // 1. Search in groups (maintaining group context)
  for (const group of groups) {
    for (const item of group.items) {
      if (matches(item) && !seenPaths.has(item.path)) {
        seenPaths.add(item.path);
        results.push({
          ...item,
          groupLabel: group.label,
        });
      }
    }
  }

  // 2. Search in quick links if any unique item remains
  for (const item of quickLinks) {
    if (matches(item) && !seenPaths.has(item.path)) {
      seenPaths.add(item.path);
      results.push({
        ...item,
        groupLabel: "오늘 바로가기",
      });
    }
  }

  return results;
}

/**
 * Calculates initial expanded state for menu groups:
 * - "고객·계약" is expanded by default for core access (e.g. core-smoke / sales analysis).
 * - The group containing the currently active page is always expanded.
 * - Other groups start collapsed.
 */
export function getInitialExpandedGroups(
  groups: NavGroup[],
  activeGroupLabel?: string | null
): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const group of groups) {
    // Expand if it's the primary "고객·계약" group or the currently active group
    state[group.label] =
      group.label === "고객·계약" || group.label === activeGroupLabel;
  }
  return state;
}
