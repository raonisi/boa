import { trpc } from "@/lib/trpc";
import type { ConsultStatus } from "@shared/salesPipeline";
import { useEffect, useMemo, useState } from "react";

export type CustomerLookupEntry = {
  id: number;
  name: string;
  consultStatus: ConsultStatus;
  agentId: number | null;
};

export function useCustomerLookup(customerIds: number[]) {
  const utils = trpc.useUtils();
  const stableKey = useMemo(
    () =>
      Array.from(new Set(customerIds))
        .sort((a, b) => a - b)
        .join(","),
    [customerIds]
  );
  const [lookup, setLookup] = useState<Record<number, CustomerLookupEntry>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const ids = stableKey
      ? stableKey.split(",").map(Number).filter(Boolean)
      : [];
    if (ids.length === 0) {
      setLookup({});
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      const entries = await Promise.all(
        ids.map(async id => {
          try {
            const customer = await utils.customers.get.fetch({ id });
            return [
              id,
              {
                id: customer.id,
                name: customer.name,
                consultStatus: customer.consultStatus,
                agentId: customer.agentId ?? null,
              },
            ] as const;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const nextLookup: Record<number, CustomerLookupEntry> = {};
      for (const entry of entries) {
        if (!entry) continue;
        const [id, customer] = entry;
        nextLookup[id] = {
          id: customer.id,
          name: customer.name,
          consultStatus: customer.consultStatus,
          agentId: customer.agentId ?? null,
        };
      }
      setLookup(nextLookup);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [stableKey, utils.customers.get]);

  return { lookup, isLoading };
}
