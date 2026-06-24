import { canAccessRoutePath } from "@/lib/routeAccess";

type ReferralFlowUser = {
  id?: number;
  role?: string | null;
  accountStatus?: string | null;
};

export function canManageReferralFlow(
  user: ReferralFlowUser | null | undefined,
  pageCustomer: { agentId?: number | null; id?: number } | null | undefined,
  anchorCustomerId: number
) {
  if (!user || user.accountStatus !== "active") return false;
  if (user.role !== "member") return true;
  if (!pageCustomer || pageCustomer.agentId !== user.id) return false;
  return anchorCustomerId === pageCustomer.id;
}

export function canAccessReferralManagement(
  user: ReferralFlowUser | null | undefined
) {
  return canAccessRoutePath("/referrals", user);
}
