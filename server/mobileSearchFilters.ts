/**
 * Mobile REST list helpers — scoped caller results only; never widens RBAC.
 */

export function parseMobileSearchQuery(raw: unknown): { ok: true; value: string | undefined } | { ok: false } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (typeof raw !== "string") return { ok: false };
  const trimmed = raw.trim();
  if (trimmed.length > 100) return { ok: false };
  return { ok: true, value: trimmed.length > 0 ? trimmed : undefined };
}

type ContractSearchRow = {
  productName?: string | null;
  company?: string | null;
  productGroup?: string | null;
  contractStatus?: string | null;
  paymentStatus?: string | null;
};

/** In-memory filter on already scoped contract rows (contracts.list has no search input). */
export function filterMobileContracts<T extends ContractSearchRow>(rows: T[], search: string): T[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    const fields = [
      row.productName,
      row.company,
      row.productGroup,
      row.contractStatus,
      row.paymentStatus,
    ];
    return fields.some((v) => typeof v === "string" && v.toLowerCase().includes(needle));
  });
}

type CustomerSearchRow = {
  name?: string | null;
  phone?: string | null;
  consultStatus?: string | null;
  nextAction?: string | null;
  priority?: string | null;
  customerTags?: string | null;
};

/** Fallback in-memory filter when caller rows are already scoped (prefer DB search via customers.list input). */
export function filterMobileCustomers<T extends CustomerSearchRow>(rows: T[], search: string): T[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    const fields = [
      row.name,
      row.phone,
      row.consultStatus,
      row.nextAction,
      row.priority,
      row.customerTags,
    ];
    return fields.some((v) => typeof v === "string" && v.toLowerCase().includes(needle));
  });
}

export function paginateMobileList<T>(rows: T[], offset: number, pageSize: number): {
  items: T[];
  hasMore: boolean;
  nextOffset: number | null;
} {
  const fetchLimit = pageSize + 1;
  const windowed = rows.slice(offset, offset + fetchLimit);
  const hasMore = windowed.length > pageSize;
  const items = hasMore ? windowed.slice(0, pageSize) : windowed;
  return {
    items,
    hasMore,
    nextOffset: hasMore ? offset + pageSize : null,
  };
}
