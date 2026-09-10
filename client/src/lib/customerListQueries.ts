import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  getAssignmentAccessError,
  getAssignmentScopeKey,
} from "./customerAssignQueries";
import { newDbDateRange } from "@/components/customers/customerListQuickPresets";
import { useQuery } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type ListInput = inferRouterInputs<AppRouter>["customers"]["list"];

export const CUSTOMER_SORT_LABELS = {
  recent: "최근 등록순",
  name: "고객명순",
  next_contact: "다음 연락순",
  contract_value: "월납보험료순",
} as const;

export function useCustomerListQueries(
  input: ListInput,
  filters: {
    preset: string | null;
    workspace: string;
    recommendation: string;
  }
) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const scope = getAssignmentScopeKey(user);
  const options = {
    enabled: user?.accountStatus === "active",
    gcTime: 0,
    retry: (count: number, error: unknown) =>
      !getAssignmentAccessError(error) && count < 3,
  };
  const recommendations = useQuery({
    ...options,
    queryKey: [
      ...getQueryKey(
        trpc.recommendations.priorityContacts,
        { limit: 50, includeWarnings: true },
        "query"
      ),
      scope,
    ],
    queryFn: ({ signal }) =>
      utils.client.recommendations.priorityContacts.query(
        { limit: 50, includeWarnings: true },
        { signal }
      ),
  });
  const needsRecommendations =
    filters.recommendation !== "all" ||
    ["priority-contact", "priority-urgent", "long-unmanaged"].includes(
      filters.preset ?? ""
    ) ||
    (!filters.preset && ["priority", "warning"].includes(filters.workspace));
  const recommendationReady =
    !needsRecommendations || recommendations.isSuccess;
  const candidateIds = needsRecommendations
    ? (recommendations.data ?? [])
        .filter(item => {
          if (filters.recommendation === "high" && item.urgency !== "high")
            return false;
          if (filters.recommendation === "warning" && !item.warnings.length)
            return false;
          if (filters.preset === "priority-urgent")
            return item.urgency === "high";
          if (filters.preset === "long-unmanaged")
            return item.warnings.some(w => w.warningType === "long_unmanaged");
          if (!filters.preset && filters.workspace === "warning")
            return item.warnings.length > 0;
          return true;
        })
        .map(item => item.customerId)
        .sort((a, b) => a - b)
    : undefined;
  const workflow = filters.preset
    ? {
        uncontacted: "uncontacted",
        "sla-overdue": "sla_overdue",
        "no-next-action": "no_next_action",
      }[filters.preset]
    : filters.workspace;
  const listInput: ListInput = {
    ...input,
    workflowFilter: ["uncontacted", "sla_overdue", "no_next_action"].includes(
      workflow ?? ""
    )
      ? (workflow as ListInput["workflowFilter"])
      : undefined,
    customerIds: candidateIds,
    followUpPreset:
      filters.preset === "today-follow-up"
        ? "today"
        : filters.preset === "overdue-follow-up"
          ? "overdue"
          : undefined,
  };
  const {
    page: _page,
    pageSize: _size,
    sort: _sort,
    segment: _segment,
    ...countInput
  } = listInput;
  const listPrefix = getQueryKey(trpc.customers.list, undefined, "query");
  const customers = useQuery({
    ...options,
    enabled: options.enabled && recommendationReady,
    queryKey: [...getQueryKey(trpc.customers.list, listInput, "query"), scope],
    queryFn: ({ signal }) =>
      utils.client.customers.list.query(listInput, { signal }),
  });
  // List invalidations from edits/details also refresh counts. Aggregate keys omit pagination/sort.
  const counts = useQuery({
    ...options,
    enabled: options.enabled && recommendationReady,
    queryKey: [...listPrefix, { segmentCounts: countInput }, scope],
    queryFn: ({ signal }) =>
      utils.client.customers.segmentCounts.query(countInput, { signal }),
  });
  const dates = newDbDateRange();
  const quickInput = {
    segment: input.segment ?? ("all" as const),
    newDbFrom: dates.from,
    newDbTo: dates.to,
    recommendationIds: recommendations.isSuccess
      ? recommendations.data.map(item => item.customerId).sort((a, b) => a - b)
      : undefined,
    urgentIds: recommendations.isSuccess
      ? recommendations.data
          .filter(item => item.urgency === "high")
          .map(item => item.customerId)
          .sort((a, b) => a - b)
      : undefined,
  };
  const quickCounts = useQuery({
    ...options,
    queryKey: [...listPrefix, { quickCounts: quickInput }, scope],
    queryFn: ({ signal }) =>
      utils.client.customers.quickCounts.query(quickInput, { signal }),
  });
  const accessError = [customers, counts, quickCounts, recommendations]
    .map(query => getAssignmentAccessError(query.error ?? query.failureReason))
    .find(Boolean);
  const dependencyError = needsRecommendations && recommendations.isError;
  const retry = async () => {
    await Promise.all([
      customers.refetch(),
      counts.refetch(),
      quickCounts.refetch(),
      recommendations.refetch(),
    ]);
  };
  return {
    customers,
    counts,
    quickCounts,
    recommendations,
    accessError,
    dependencyError,
    ready: recommendationReady && !accessError,
    retry,
  };
}
