type RetentionRiskUser = {
  id?: number;
  role?: string | null;
  accountStatus?: string | null;
};

export function canManageRetentionRisk(
  user: RetentionRiskUser | null | undefined,
  pageCustomer: { agentId?: number | null } | null | undefined
) {
  if (!user || user.accountStatus !== "active") return false;
  if (user.role !== "member") return true;
  return Boolean(pageCustomer && pageCustomer.agentId === user.id);
}

export function canAccessRetentionRiskManagement(
  user: RetentionRiskUser | null | undefined
) {
  return Boolean(user && user.accountStatus === "active");
}
