import { useAuth } from "@/_core/hooks/useAuth";
import { isUnauthorizedSessionError } from "@/lib/appSessionResume";
import { trpc } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { getQueryKey } from "@trpc/react-query";

export type AssignmentQueryState = {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  hasData: boolean;
};

export function getAssignmentScopeKey(
  user: ReturnType<typeof useAuth>["user"]
) {
  return JSON.stringify(
    user && [
      user.id,
      user.role,
      user.accountStatus,
      user.teamId,
      user.subBranchAdminId,
      user.parentUserId,
      user.sessionInvalidatedAt,
    ]
  );
}

export function getAssignmentAccessError(error: unknown) {
  if (isUnauthorizedSessionError(error)) return "unauthorized" as const;
  if (error instanceof TRPCClientError && error.data?.code === "FORBIDDEN") {
    return "forbidden" as const;
  }
  return null;
}

export function useAssignmentQueries(
  input: { unassigned?: boolean; assignmentStatus?: "unassigned" } = {}
) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const scope = getAssignmentScopeKey(user);
  const options = {
    enabled: user?.accountStatus === "active",
    // Do not retain an assignment workspace after leaving its account/scope.
    gcTime: 0,
    retry: (count: number, error: unknown) =>
      !getAssignmentAccessError(error) && count < 3,
  };
  // Keep tRPC's key prefix so existing list invalidations still reach these queries.
  // The additional client-only scope is never sent to the server.
  const customers = useQuery({
    ...options,
    queryKey: [...getQueryKey(trpc.customers.list, input, "query"), scope],
    queryFn: ({ signal }) =>
      utils.client.customers.list.query(input, { signal }),
  });
  const users = useQuery({
    ...options,
    queryKey: [...getQueryKey(trpc.users.list, undefined, "query"), scope],
    queryFn: ({ signal }) =>
      utils.client.users.list.query(undefined, { signal }),
  });
  const accessError =
    getAssignmentAccessError(customers.error ?? customers.failureReason) ??
    getAssignmentAccessError(users.error ?? users.failureReason);
  return {
    customers,
    users,
    accessError,
    canAssign:
      customers.isSuccess &&
      customers.fetchStatus === "idle" &&
      users.isSuccess &&
      users.fetchStatus === "idle",
    customerState: {
      isPending: customers.isPending,
      isError: customers.isError,
      isFetching: customers.fetchStatus !== "idle",
      hasData: customers.data !== undefined,
    } satisfies AssignmentQueryState,
  };
}

export type AssignmentQueries = ReturnType<typeof useAssignmentQueries>;
