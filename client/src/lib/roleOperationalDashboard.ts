import {
  buildCustomerListPresetPath,
  type CustomerListUrlPresetId,
} from "@/components/customers/customerListUrlPresets";
import type { PremiumStatCardTone } from "@/components/dashboard/PremiumStatCard";

export type TodayWorkCardMetrics = {
  todayFollowUpCount?: number;
  overdueFollowUpCount?: number;
  todayScheduleCount?: number;
  pendingNotificationCount?: number;
  longUnmanagedCustomerCount?: number;
  incompleteScheduleCount?: number;
};

export type OperationalCardDef = {
  id: string;
  title: string;
  description: string;
  scopeLabel: string;
  metricKey: keyof TodayWorkCardMetrics;
  link:
    | { type: "preset"; preset: CustomerListUrlPresetId }
    | { type: "route"; path: string };
  tone?: PremiumStatCardTone;
};

export type MemberQuickAction = {
  id: string;
  label: string;
  hint: string;
  path: string;
};

export type ManagerQuickLink = {
  label: string;
  hint: string;
  path: string;
};

export function getScopeLabel(role?: string | null): string {
  switch (role) {
    case "sub_branch_admin":
      return "산하 조직";
    case "team_leader":
      return "내 팀";
    case "member":
      return "내 고객";
    case "branch_admin":
      return "지점 전체";
    default:
      return "권한 범위";
  }
}

function presetLink(preset: CustomerListUrlPresetId) {
  return { type: "preset" as const, preset };
}

function routeLink(path: string) {
  return { type: "route" as const, path };
}

export function resolveOperationalCardPath(
  link: OperationalCardDef["link"]
): string {
  return link.type === "preset"
    ? buildCustomerListPresetPath(link.preset)
    : link.path;
}

export function getOperationalCardsForRole(
  role?: string | null
): OperationalCardDef[] {
  const scopeLabel = getScopeLabel(role);

  const todayContact: OperationalCardDef = {
    id: "today-contact",
    title: "오늘 연락 대상",
    description: "오늘 안에 연락이 필요한 후속관리",
    scopeLabel,
    metricKey: "todayFollowUpCount",
    link: presetLink("today-follow-up"),
    tone: "gold",
  };
  const overdueFollowUp: OperationalCardDef = {
    id: "overdue-followup",
    title: "기한 경과 후속관리",
    description: "예정일이 지난 재연락 업무",
    scopeLabel,
    metricKey: "overdueFollowUpCount",
    link: presetLink("overdue-follow-up"),
    tone: "red",
  };
  const todaySchedule: OperationalCardDef = {
    id: "today-schedule",
    title: "오늘 일정",
    description: "오늘 진행할 상담·계약 일정",
    scopeLabel,
    metricKey: "todayScheduleCount",
    link: routeLink("/calendar"),
    tone: "blue",
  };
  const notifications: OperationalCardDef = {
    id: "notifications",
    title: "읽지 않은 알림",
    description: "확인이 필요한 업무 알림",
    scopeLabel,
    metricKey: "pendingNotificationCount",
    link: routeLink("/notifications"),
    tone: "orange",
  };
  const longUnmanaged: OperationalCardDef = {
    id: "long-unmanaged",
    title: "장기 미관리 고객",
    description: "관리 공백이 긴 고객 점검",
    scopeLabel,
    metricKey: "longUnmanagedCustomerCount",
    link: presetLink("long-unmanaged"),
    tone: "navy",
  };
  const incompleteSchedule: OperationalCardDef = {
    id: "incomplete-schedule",
    title: "미완료 일정",
    description: "처리가 남아 있는 일정",
    scopeLabel,
    metricKey: "incompleteScheduleCount",
    link: routeLink("/calendar"),
    tone: "orange",
  };
  const priorityContact: OperationalCardDef = {
    id: "priority-contact",
    title: "우선 연락 고객",
    description: "우선순위 기준 확인이 필요한 고객",
    scopeLabel,
    metricKey: "todayFollowUpCount",
    link: presetLink("priority-contact"),
    tone: "green",
  };

  if (role === "member") {
    return [todayContact, overdueFollowUp, todaySchedule, priorityContact];
  }

  if (role === "sub_branch_admin" || role === "team_leader") {
    return [
      todayContact,
      overdueFollowUp,
      todaySchedule,
      notifications,
      longUnmanaged,
      incompleteSchedule,
    ];
  }

  return [];
}

export function getMemberQuickActions(): MemberQuickAction[] {
  return [
    {
      id: "today-contact",
      label: "오늘 연락",
      hint: "오늘 연락할 고객",
      path: buildCustomerListPresetPath("today-follow-up"),
    },
    {
      id: "overdue-followup",
      label: "기한 경과 후속",
      hint: "예정일이 지난 후속관리",
      path: buildCustomerListPresetPath("overdue-follow-up"),
    },
    {
      id: "quick-followup",
      label: "빠른 후속관리",
      hint: "고객 선택 후 등록",
      path: "/customers?action=quick-followup",
    },
    {
      id: "quick-consult",
      label: "상담 기록",
      hint: "고객 선택 후 기록",
      path: "/customers",
    },
    {
      id: "priority-contact",
      label: "우선 연락",
      hint: "우선 연락 고객",
      path: buildCustomerListPresetPath("priority-contact"),
    },
    {
      id: "my-customers",
      label: "내 고객",
      hint: "담당 고객 목록",
      path: "/customers",
    },
    {
      id: "customer-search",
      label: "고객 검색",
      hint: "이름·연락처 검색",
      path: "/customers",
    },
    {
      id: "calendar",
      label: "오늘 일정",
      hint: "일정 캘린더",
      path: "/calendar",
    },
  ];
}

export function getManagerQuickLinks(role?: string | null): ManagerQuickLink[] {
  const scope = getScopeLabel(role);
  return [
    {
      label: "고객 목록",
      hint: `${scope} 고객 보기`,
      path: "/customers",
    },
    {
      label: "DB 배정",
      hint: "담당자 배정·배분",
      path: "/customers/assign",
    },
    {
      label: "팀 운영 현황",
      hint: "담당자별 업무 확인",
      path: "/team-insights",
    },
  ];
}

export type TeamSupportAssignee = {
  userId: number;
  name: string;
  roleLabel: string;
  openWorkCount: number;
  overdueFollowUpCount: number;
  todayFollowUpCount: number;
};

export function pickTeamSupportAssignees(
  userMetrics: Array<{
    user: { id: number; name?: string | null; role?: string | null };
    metrics: {
      overdueFollowUpsCount: number;
      todayFollowUpsCount: number;
      incompleteSchedulesCount: number;
      unconsultedDbCount: number;
    };
  }>,
  limit = 3
): TeamSupportAssignee[] {
  return userMetrics
    .map(item => {
      const openWorkCount =
        item.metrics.overdueFollowUpsCount +
        item.metrics.incompleteSchedulesCount +
        item.metrics.unconsultedDbCount;
      return {
        userId: item.user.id,
        name: item.user.name?.trim() || `담당자 ${item.user.id}`,
        roleLabel: item.user.role ?? "member",
        openWorkCount,
        overdueFollowUpCount: item.metrics.overdueFollowUpsCount,
        todayFollowUpCount: item.metrics.todayFollowUpsCount,
      };
    })
    .filter(item => item.openWorkCount > 0)
    .sort((a, b) => b.openWorkCount - a.openWorkCount)
    .slice(0, limit);
}
