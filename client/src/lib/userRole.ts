export type UserLike = {
  id?: number;
  name?: string | null;
  role?: string | null;
  accountStatus?: string | null;
};

export const ROLE_LABELS = {
  branch_admin: "지점장",
  sub_branch_admin: "부지점장",
  team_leader: "팀장",
  member: "팀원",
} as const;

export const USER_STATUS_LABELS = {
  active: "활성",
  inactive: "비활성",
  resigned: "퇴사자",
} as const;

export const SCOPE_LABELS = {
  managed: "산하 전체",
  mine: "내 담당 고객",
  member: "조직원별",
  all: "전체",
  own: "내 담당",
  team: "팀",
  branch: "지점",
  sub_branch: "부지점",
} as const;

export const TARGET_TYPE_LABELS = {
  user: "사용자",
  users: "사용자",
  customer: "고객",
  customers: "고객",
  contract: "계약",
  contracts: "계약",
  consultation: "상담",
  consultations: "상담",
  schedule: "일정",
  schedules: "일정",
  notification: "알림",
  notifications: "알림",
  team: "팀",
  teams: "팀",
  activity_log: "활동 로그",
  activity_logs: "활동 로그",
} as const;

export function getRoleLabel(role?: string | null) {
  if (!role) return "역할 미지정";
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
}

export function getUserStatusLabel(status?: string | null) {
  if (!status) return "상태 미지정";
  return USER_STATUS_LABELS[status as keyof typeof USER_STATUS_LABELS] ?? status;
}

export function getScopeLabel(scope?: string | null) {
  if (!scope) return "범위 미지정";
  return SCOPE_LABELS[scope as keyof typeof SCOPE_LABELS] ?? scope;
}

export function getTargetTypeLabel(targetType?: string | null) {
  if (!targetType) return "-";
  return TARGET_TYPE_LABELS[targetType as keyof typeof TARGET_TYPE_LABELS] ?? targetType;
}

export function getActiveLabel(isActive?: boolean | null) {
  return isActive === false ? "비활성" : "활성";
}

const DISPLAY_ENUM_REPLACEMENTS: Record<string, string> = {
  branch_admin: "지점장",
  sub_branch_admin: "부지점장",
  team_leader: "팀장",
  member: "팀원",
  active: "활성",
  inactive: "비활성",
  resigned: "퇴사자",
  managed: "산하 전체",
  mine: "내 담당 고객",
  selectedUserId: "선택 조직원",
  ownershipScope: "조회 범위",
};

export function localizeKnownEnumText(value?: string | null) {
  if (!value) return "-";
  return Object.entries(DISPLAY_ENUM_REPLACEMENTS).sort(([a], [b]) => b.length - a.length).reduce(
    (text, [raw, label]) => text.replaceAll(raw, label),
    value,
  );
}

export function roleLabel(role?: string | null, accountStatus?: string | null) {
  if (accountStatus && accountStatus !== "active") return getUserStatusLabel(accountStatus);
  return getRoleLabel(role);
}

export function formatUserWithRole(user?: UserLike | null) {
  if (!user) return "-";
  return `${user.name ?? `사용자 #${user.id ?? "-"}`}(${getRoleLabel(user.role)})`;
}
