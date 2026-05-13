export type UserLike = {
  id?: number;
  name?: string | null;
  role?: string | null;
  accountStatus?: string | null;
};

export function roleLabel(role?: string | null, accountStatus?: string | null) {
  if (accountStatus === "inactive") return "비활성";
  if (accountStatus === "resigned") return "퇴사";
  if (role === "branch_admin") return "지점장";
  if (role === "sub_branch_admin") return "부지점장";
  if (role === "team_leader") return "팀장";
  if (role === "member") return "팀원";
  if (role === "inactive") return "비활성";
  if (role === "resigned") return "퇴사";
  return "사용자";
}

export function formatUserWithRole(user?: UserLike | null) {
  if (!user) return "-";
  return `${user.name ?? `사용자 #${user.id ?? "-"}`}(${roleLabel(user.role, user.accountStatus)})`;
}
