import { hasCustomerBulkImportAccess } from "@shared/permissions";
import type { ElementType } from "react";
import {
  Activity,
  ArrowRightLeft,
  BarChart2,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Database,
  Download,
  FileText,
  GitBranch,
  GitMerge,
  Home,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Monitor,
  Network,
  RotateCcw,
  Settings,
  ShieldCheck,
  Target,
  Upload,
  Users,
  UserSquare2,
} from "lucide-react";

export type NavItem = {
  icon: ElementType;
  label: string;
  description?: string;
  path: string;
  roles?: string[];
  canAccess?: (user: { role?: string | null } | null | undefined) => boolean;
};

export type NavGroup = {
  label: string;
  description?: string;
  items: NavItem[];
};

export function canAccessNavItem(
  item: NavItem,
  user: { role?: string | null } | null | undefined
) {
  if (item.canAccess) return item.canAccess(user);
  if (!item.roles) return true;
  return item.roles.includes(user?.role ?? "");
}

export function filterNavItems(
  items: NavItem[],
  user: { role?: string | null } | null | undefined
) {
  return items.filter(item => canAccessNavItem(item, user));
}

export function filterNavGroups(
  groups: NavGroup[],
  user: { role?: string | null } | null | undefined
): NavGroup[] {
  return groups
    .map(group => ({
      ...group,
      items: filterNavItems(group.items, user),
    }))
    .filter(group => group.items.length > 0);
}

/** PC Sidebar — 업무 흐름 중심 그룹 (RBAC 조건은 항목별 유지) */
export const sidebarNavGroups: NavGroup[] = [
  {
    label: "오늘 처리",
    description: "지금 확인·실행할 업무",
    items: [
      { icon: Home, label: "오늘 업무", path: "/" },
      { icon: Bell, label: "알림센터", path: "/notifications" },
      { icon: CalendarDays, label: "일정", path: "/calendar" },
    ],
  },
  {
    label: "고객 · DB",
    description: "고객 조회와 담당 배정",
    items: [
      { icon: Users, label: "고객 관리", path: "/customers" },
      {
        icon: UserSquare2,
        label: "DB 배정",
        description: "고객 담당자를 지정합니다",
        path: "/customers/assign",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: LayoutGrid,
        label: "세일즈 파이프라인",
        path: "/sales-pipeline",
      },
      {
        icon: GitBranch,
        label: "소개 관리",
        path: "/referrals",
        roles: ["branch_admin", "sub_branch_admin", "team_leader", "member"],
      },
      {
        icon: ClipboardList,
        label: "청구 안내 관리",
        path: "/claim-guidance",
        roles: ["branch_admin", "sub_branch_admin", "team_leader", "member"],
      },
      {
        icon: Database,
        label: "고객 데이터 품질",
        path: "/customer-data-quality",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: Database,
        label: "내 고객 데이터 보완",
        path: "/customer-data-quality",
        roles: ["member"],
      },
      {
        icon: ClipboardCheck,
        label: "사후관리 캠페인",
        path: "/aftercare-campaigns",
        roles: ["branch_admin", "sub_branch_admin", "team_leader", "member"],
      },
      {
        icon: ClipboardCheck,
        label: "온보딩 체크리스트",
        path: "/onboarding-checklists",
        roles: ["branch_admin", "sub_branch_admin", "team_leader", "member"],
      },
      {
        icon: Upload,
        label: "고객 일괄 등록",
        path: "/customers/bulk-import",
        canAccess: hasCustomerBulkImportAccess,
      },
      {
        icon: GitMerge,
        label: "중복 고객 관리",
        path: "/customers/merge",
        roles: ["branch_admin"],
      },
      {
        icon: RotateCcw,
        label: "업로드 이력 관리",
        path: "/customers/import-batches",
        roles: ["branch_admin"],
      },
    ],
  },
  {
    label: "계약 · 실적",
    items: [
      { icon: FileText, label: "계약관리", path: "/contracts" },
      { icon: BarChart3, label: "실적관리", path: "/performance" },
      { icon: Target, label: "목표관리", path: "/performance/goals" },
      { icon: BarChart2, label: "영업 분석", path: "/analytics" },
    ],
  },
  {
    label: "팀 운영",
    description: "팀·조직 관리와 코칭",
    items: [
      {
        icon: LayoutDashboard,
        label: "관리자 운영센터",
        path: "/admin/operations-center",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: Monitor,
        label: "팀원 관리",
        path: "/team-insights",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: FileText,
        label: "관리자 보고서",
        path: "/management-reports",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: ListChecks,
        label: "지점원 실행계획 관리",
        path: "/action-plans",
        roles: [
          "branch_admin",
          "sub_branch_admin",
          "team_leader",
          "member",
        ],
      },
      {
        icon: Activity,
        label: "첫 연락 SLA",
        path: "/admin/sla",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: Activity,
        label: "팀원 업무 처리율",
        path: "/admin/team-completion",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: Activity,
        label: "팀원 코칭 노트",
        path: "/admin/team-coaching",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: Network,
        label: "조직 구조",
        path: "/organization",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: Users,
        label: "팀 관리",
        path: "/teams",
        roles: ["branch_admin"],
      },
      {
        icon: ArrowRightLeft,
        label: "인수인계 관리",
        path: "/users/handoff",
        roles: ["branch_admin"],
      },
    ],
  },
  {
    label: "운영 리스크",
    items: [
      {
        icon: ShieldCheck,
        label: "운영 리스크",
        description: "오늘 확인이 필요한 위험 신호",
        path: "/operation-risk",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
    ],
  },
  {
    label: "보안 · 감사",
    description: "로그·다운로드·삭제 데이터",
    items: [
      {
        icon: Activity,
        label: "활동 로그",
        path: "/logs",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: Download,
        label: "데이터 다운로드",
        path: "/download",
        roles: ["branch_admin"],
      },
      {
        icon: RotateCcw,
        label: "삭제 데이터 관리",
        path: "/deleted-data",
        roles: ["branch_admin"],
      },
      {
        icon: BellRing,
        label: "푸시 알림 운영",
        path: "/push-notifications",
        roles: ["branch_admin"],
      },
    ],
  },
  {
    label: "설정 · 도구",
    items: [
      {
        icon: BookOpen,
        label: "사용자 관리",
        path: "/users",
        roles: ["branch_admin"],
      },
      {
        icon: ClipboardCheck,
        label: "상담 도구 관리",
        path: "/consultation-tools",
        roles: ["branch_admin"],
      },
      {
        icon: CalendarDays,
        label: "Google Calendar 연동",
        path: "/google-calendar-integration",
        roles: ["branch_admin", "sub_branch_admin", "team_leader", "member"],
      },
      {
        icon: Settings,
        label: "설정 관리",
        path: "/settings",
        roles: ["branch_admin"],
      },
      {
        icon: BellRing,
        label: "앱 알림 설정",
        path: "/notification-preferences",
      },
    ],
  },
];

export const mobilePrimaryItems: NavItem[] = [
  { icon: Home, label: "오늘 업무", path: "/" },
  { icon: Users, label: "내 고객", path: "/customers" },
  { icon: CalendarDays, label: "일정", path: "/calendar" },
  { icon: Bell, label: "알림", path: "/notifications" },
];

/** 역할별 더보기 상단 바로가기 — 기존 route만 사용 */
export function mobileQuickLinksForRole(
  role?: string | null
): NavItem[] {
  const adminLinks: NavItem[] = [
    {
      icon: ShieldCheck,
      label: "운영 리스크",
      description: "오늘 확인 필요",
      path: "/operation-risk",
      roles: ["branch_admin", "sub_branch_admin", "team_leader"],
    },
    {
      icon: UserSquare2,
      label: "DB 배정",
      description: "담당자 지정",
      path: "/customers/assign",
      roles: ["branch_admin", "sub_branch_admin", "team_leader"],
    },
    {
      icon: Monitor,
      label: "팀원 관리",
      path: "/team-insights",
      roles: ["branch_admin", "sub_branch_admin", "team_leader"],
    },
    {
      icon: Activity,
      label: "활동 로그",
      path: "/logs",
      roles: ["branch_admin", "sub_branch_admin", "team_leader"],
    },
    {
      icon: Download,
      label: "데이터 다운로드",
      path: "/download",
      roles: ["branch_admin"],
    },
  ];

  const memberLinks: NavItem[] = [
    {
      icon: LayoutGrid,
      label: "파이프라인",
      path: "/sales-pipeline",
    },
    {
      icon: FileText,
      label: "계약관리",
      path: "/contracts",
    },
  ];

  if (role === "member") {
    return filterNavItems(memberLinks, { role });
  }
  return filterNavItems(adminLinks, { role });
}

/** MobileNav 더보기 — 업무 그룹 */
export const mobileMoreNavGroups: NavGroup[] = [
  {
    label: "고객 · 계약",
    items: [
      { icon: BarChart2, label: "영업 분석", path: "/analytics" },
      { icon: LayoutGrid, label: "세일즈 파이프라인", path: "/sales-pipeline" },
      {
        icon: GitBranch,
        label: "소개 관리",
        path: "/referrals",
        roles: ["branch_admin", "sub_branch_admin", "team_leader", "member"],
      },
      {
        icon: ClipboardList,
        label: "청구 안내 관리",
        path: "/claim-guidance",
        roles: ["branch_admin", "sub_branch_admin", "team_leader", "member"],
      },
      { icon: FileText, label: "계약관리", path: "/contracts" },
      {
        icon: Upload,
        label: "고객 일괄 등록",
        path: "/customers/bulk-import",
        canAccess: hasCustomerBulkImportAccess,
      },
      {
        icon: GitMerge,
        label: "중복 고객 관리",
        path: "/customers/merge",
        roles: ["branch_admin"],
      },
      {
        icon: Database,
        label: "고객 데이터 품질",
        path: "/customer-data-quality",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: Database,
        label: "내 고객 데이터 보완",
        path: "/customer-data-quality",
        roles: ["member"],
      },
      {
        icon: ClipboardCheck,
        label: "사후관리 캠페인",
        path: "/aftercare-campaigns",
        roles: ["branch_admin", "sub_branch_admin", "team_leader", "member"],
      },
      {
        icon: ClipboardCheck,
        label: "온보딩 체크리스트",
        path: "/onboarding-checklists",
        roles: ["branch_admin", "sub_branch_admin", "team_leader", "member"],
      },
    ],
  },
  {
    label: "실적 · 목표",
    items: [
      { icon: BarChart3, label: "실적관리", path: "/performance" },
      { icon: Target, label: "목표관리", path: "/performance/goals" },
    ],
  },
  {
    label: "팀 · 조직",
    items: [
      {
        icon: LayoutDashboard,
        label: "관리자 운영센터",
        path: "/admin/operations-center",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: FileText,
        label: "관리자 보고서",
        path: "/management-reports",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: ListChecks,
        label: "지점원 실행계획 관리",
        path: "/action-plans",
        roles: [
          "branch_admin",
          "sub_branch_admin",
          "team_leader",
          "member",
        ],
      },
      {
        icon: Monitor,
        label: "팀원 관리",
        path: "/team-insights",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: Network,
        label: "조직 구조",
        path: "/organization",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: Users,
        label: "팀 관리",
        path: "/teams",
        roles: ["branch_admin"],
      },
      {
        icon: ArrowRightLeft,
        label: "인수인계 관리",
        path: "/users/handoff",
        roles: ["branch_admin"],
      },
      {
        icon: Activity,
        label: "첫 연락 SLA",
        path: "/admin/sla",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: Activity,
        label: "팀원 업무 처리율",
        path: "/admin/team-completion",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: Activity,
        label: "팀원 코칭 노트",
        path: "/admin/team-coaching",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
    ],
  },
  {
    label: "운영 · 보안",
    items: [
      {
        icon: ShieldCheck,
        label: "운영 리스크",
        path: "/operation-risk",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: Activity,
        label: "활동 로그",
        path: "/logs",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      },
      {
        icon: BellRing,
        label: "푸시 알림 운영",
        path: "/push-notifications",
        roles: ["branch_admin"],
      },
      {
        icon: RotateCcw,
        label: "삭제 데이터 관리",
        path: "/deleted-data",
        roles: ["branch_admin"],
      },
      {
        icon: RotateCcw,
        label: "업로드 이력 관리",
        path: "/customers/import-batches",
        roles: ["branch_admin"],
      },
      {
        icon: Download,
        label: "데이터 다운로드",
        path: "/download",
        roles: ["branch_admin"],
      },
      {
        icon: Users,
        label: "사용자 관리",
        path: "/users",
        roles: ["branch_admin"],
      },
      {
        icon: ClipboardCheck,
        label: "상담 도구 관리",
        path: "/consultation-tools",
        roles: ["branch_admin"],
      },
      {
        icon: Settings,
        label: "설정 관리",
        path: "/settings",
        roles: ["branch_admin"],
      },
    ],
  },
  {
    label: "설정",
    items: [
      {
        icon: BellRing,
        label: "앱 알림 설정",
        path: "/notification-preferences",
      },
    ],
  },
];

export const pageTitles: Array<{ prefix: string; title: string }> = [
  { prefix: "/analytics", title: "영업 분석" },
  { prefix: "/claim-guidance", title: "청구 안내 관리" },
  { prefix: "/referrals", title: "소개 관리" },
  { prefix: "/sales-pipeline", title: "세일즈 파이프라인" },
  { prefix: "/customers/assign", title: "DB 배정" },
  { prefix: "/customers/bulk-import", title: "고객 일괄 등록" },
  { prefix: "/customers/import-batches", title: "업로드 이력 관리" },
  { prefix: "/admin/team-completion", title: "팀원 업무 처리율" },
  { prefix: "/admin/team-coaching", title: "팀원 코칭 노트" },
  { prefix: "/customers/merge", title: "중복 고객 관리" },
  { prefix: "/customer-data-quality", title: "고객 데이터 품질" },
  { prefix: "/customers", title: "고객 관리" },
  { prefix: "/contracts", title: "계약관리" },
  { prefix: "/performance/goals", title: "목표관리" },
  { prefix: "/performance", title: "실적관리" },
  { prefix: "/notifications", title: "알림센터" },
  { prefix: "/aftercare-campaigns", title: "사후관리 캠페인" },
  { prefix: "/onboarding-checklists", title: "온보딩 체크리스트" },
  { prefix: "/notification-preferences", title: "앱 알림 설정" },
  { prefix: "/push-notifications", title: "푸시 알림 운영" },
  { prefix: "/calendar", title: "일정" },
  { prefix: "/users/handoff", title: "인수인계 관리" },
  { prefix: "/organization", title: "조직 구조" },
  { prefix: "/users", title: "사용자 관리" },
  { prefix: "/admin/operations-center", title: "관리자 운영센터" },
  { prefix: "/management-reports", title: "관리자 보고서" },
  { prefix: "/action-plans", title: "지점원 실행계획 관리" },
  { prefix: "/google-calendar-integration", title: "Google Calendar 연동 관리" },
  { prefix: "/team-insights", title: "팀원 관리" },
  { prefix: "/admin/sla", title: "첫 연락 SLA" },
  { prefix: "/teams", title: "팀 관리" },
  { prefix: "/operation-risk", title: "운영 리스크" },
  { prefix: "/logs", title: "활동 로그" },
  { prefix: "/deleted-data", title: "삭제 데이터 관리" },
  { prefix: "/download", title: "데이터 다운로드" },
  { prefix: "/consultation-tools", title: "상담 도구 관리" },
  { prefix: "/settings", title: "설정 관리" },
];

export function getPageTitle(path: string) {
  if (path === "/") return "오늘 업무";
  return pageTitles.find(item => path.startsWith(item.prefix))?.title ?? "BOA CRM";
}
