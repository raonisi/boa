import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  Bell,
  BellRing,
  ClipboardCheck,
  Database,
  Download,
  GitMerge,
  Home,
  LayoutDashboard,
  Network,
  RotateCcw,
  ShieldCheck,
  Target,
  Upload,
  UserCog,
  Users,
} from "lucide-react";

export type AdminHubUser = {
  role?: string | null;
  accountStatus?: string | null;
  permissions?: string[] | null;
};

export type ManagerRole = "branch_admin" | "sub_branch_admin" | "team_leader";

export type AdminCardSection =
  | "organization-users"
  | "customer-db"
  | "team-work"
  | "operations-security"
  | "notifications-push"
  | "goals-performance";

export type RiskLevel = "normal" | "caution" | "high" | "branch_admin_only";

export type CardStatus =
  | "available"
  | "beta"
  | "coming_soon"
  | "branch_admin_only"
  | "production_ready";

export type AdminOperationCard = {
  id: string;
  title: string;
  description: string;
  section: AdminCardSection;
  allowedRoles: ManagerRole[];
  route?: string;
  riskLevel: RiskLevel;
  status: CardStatus;
  icon: LucideIcon;
  isComingSoon?: boolean;
};

export const PAGE_TITLE = "관리자 운영센터";

export const PAGE_DESCRIPTION =
  "조직 운영, 팀원 관리, 고객 DB 관리, 보안·위험 작업을 한곳에서 확인합니다.";

export const COMING_SOON_NOTICE = [
  "현재 준비 중인 기능입니다.",
  "기존 고객관리·후속관리·보고서 기능으로 관련 업무를 확인할 수 있습니다.",
] as const;

export const AVAILABLE_NOTICE = ["현재 사용할 수 있는 기능입니다."] as const;

export const BETA_NOTICE = [
  "기능은 구현되어 있으나 조직 전체 공개 전 추가 검수를 권장합니다.",
] as const;

export const PRODUCTION_READY_NOTICE = [
  "운영 검수와 테스트가 완료된 안정 기능입니다.",
] as const;

export const RESTRICTED_NOTICE = [
  "권한이 있는 관리자만 사용할 수 있는 민감 작업입니다.",
] as const;

export const PERMISSION_DENIED_TITLE = "접근 권한이 없습니다";

export const PERMISSION_DENIED_DESCRIPTION =
  "관리자 운영센터는 지점장, 부지점장, 팀장만 사용할 수 있습니다. 필요한 경우 관리자에게 문의해 주세요.";

export const NO_VISIBLE_CARDS_TITLE =
  "현재 권한으로는 이 기능을 사용할 수 없습니다.";

export const NO_VISIBLE_CARDS_DESCRIPTION =
  "필요한 경우 지점장에게 권한 또는 담당 범위를 확인해 주세요.";

export const HIGH_RISK_NOTICE = [
  "이 기능은 고객정보, 계정, 삭제 데이터와 연결된 민감한 작업입니다.",
  "처리 전 대상과 사유를 반드시 확인해 주세요.",
] as const;

export const ADMIN_OPERATION_SECTIONS: Array<{
  id: AdminCardSection;
  title: string;
  description: string;
}> = [
  {
    id: "organization-users",
    title: "조직·사용자 관리",
    description:
      "직원 계정, 조직 구조, 담당자 변경, 인수인계와 계정 보안을 관리합니다.",
  },
  {
    id: "customer-db",
    title: "고객·DB 운영",
    description:
      "고객 DB 조회, 배정, 병합, 삭제 데이터와 업로드 이력을 운영합니다.",
  },
  {
    id: "team-work",
    title: "팀원 업무 관리",
    description: "팀원별 고객관리, SLA, 후속관리, 코칭과 온보딩을 점검합니다.",
  },
  {
    id: "operations-security",
    title: "운영·보안 관리",
    description:
      "운영 점검, 활동 로그, 위험 작업과 다운로드 사유를 확인합니다.",
  },
  {
    id: "notifications-push",
    title: "알림·푸시 관리",
    description: "알림센터, 푸시 운영, 발송 로그와 미수신 원인을 확인합니다.",
  },
  {
    id: "goals-performance",
    title: "목표·실적 관리",
    description: "목표, 실적, 업무 리듬과 팀원별 성과를 확인합니다.",
  },
];

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  normal: "일반",
  caution: "주의 필요",
  high: "신중 처리",
  branch_admin_only: "지점장 전용",
};

export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  available: "사용 가능",
  beta: "검수 필요",
  coming_soon: "준비 중",
  branch_admin_only: "지점장 전용",
  production_ready: "운영 안정",
};

export const ROLE_SCOPE_HINTS: Record<ManagerRole, string> = {
  branch_admin:
    "전체 조직의 고객, 계약, 실적, 권한, 위험 작업을 통합 관리합니다.",
  sub_branch_admin:
    "산하 조직의 고객관리, 팀장 업무, 후속관리 누락을 확인합니다.",
  team_leader: "산하 팀원의 고객관리, 일정, 후속관리, 실적 흐름을 점검합니다.",
};

export const ADMIN_OPERATION_CARDS: AdminOperationCard[] = [
  {
    id: "user-management",
    title: "사용자 관리",
    description: "직원 계정, 역할, 상태, 로그인 관련 설정을 관리합니다.",
    section: "organization-users",
    allowedRoles: ["branch_admin"],
    route: "/users",
    riskLevel: "high",
    status: "available",
    icon: Users,
  },
  {
    id: "organization",
    title: "조직관리",
    description: "지점장, 부지점장, 팀장, 팀원 구조를 정리합니다.",
    section: "organization-users",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/organization",
    riskLevel: "normal",
    status: "available",
    icon: Network,
  },
  {
    id: "assignee-change",
    title: "담당자 변경",
    description: "고객 담당자를 안전하게 변경하고 이력을 확인합니다.",
    section: "organization-users",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/customers",
    riskLevel: "caution",
    status: "available",
    icon: UserCog,
  },
  {
    id: "user-handoff",
    title: "퇴사자 인수인계",
    description: "퇴사·이동 직원의 고객과 계약을 새로운 담당자에게 넘깁니다.",
    section: "organization-users",
    allowedRoles: ["branch_admin"],
    route: "/users/handoff",
    riskLevel: "high",
    status: "available",
    icon: ArrowRightLeft,
  },
  {
    id: "oauth-reset",
    title: "OAuth 초기화",
    description: "로그인 문제가 있는 계정의 Google OAuth 연결을 초기화합니다.",
    section: "organization-users",
    allowedRoles: ["branch_admin"],
    route: "/users",
    riskLevel: "branch_admin_only",
    status: "branch_admin_only",
    icon: ShieldCheck,
  },
  {
    id: "force-logout",
    title: "강제 로그아웃",
    description: "보안상 필요한 경우 특정 사용자의 세션을 종료합니다.",
    section: "organization-users",
    allowedRoles: ["branch_admin"],
    route: "/users",
    riskLevel: "branch_admin_only",
    status: "branch_admin_only",
    icon: ShieldCheck,
  },
  {
    id: "customer-db",
    title: "고객 DB 관리",
    description:
      "전체 고객과 내 담당 고객을 조회합니다. 고객 상세에서 30초 퀵 상담, 접점 타임라인을 함께 사용할 수 있습니다.",
    section: "customer-db",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/customers",
    riskLevel: "normal",
    status: "available",
    icon: Database,
  },
  {
    id: "db-assign",
    title: "DB 배정",
    description: "신규 DB를 팀장 또는 팀원에게 배정합니다.",
    section: "customer-db",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/customers/assign",
    riskLevel: "normal",
    status: "available",
    icon: UserCog,
  },
  {
    id: "customer-merge",
    title: "고객 병합",
    description: "중복 고객 후보를 확인하고 안전하게 병합합니다.",
    section: "customer-db",
    allowedRoles: ["branch_admin"],
    route: "/customers/merge",
    riskLevel: "caution",
    status: "available",
    icon: GitMerge,
  },
  {
    id: "deleted-data",
    title: "삭제 데이터 관리",
    description: "삭제된 고객·계약 데이터를 확인하고 복구합니다.",
    section: "customer-db",
    allowedRoles: ["branch_admin"],
    route: "/deleted-data",
    riskLevel: "high",
    status: "branch_admin_only",
    icon: RotateCcw,
  },
  {
    id: "import-batches",
    title: "일괄 등록 이력",
    description: "엑셀·CSV 업로드 이력과 처리 결과를 확인합니다.",
    section: "customer-db",
    allowedRoles: ["branch_admin"],
    route: "/customers/import-batches",
    riskLevel: "normal",
    status: "available",
    icon: Upload,
  },
  {
    id: "assignee-history",
    title: "담당자 변경 이력",
    description: "고객 담당자 변경 내역을 추적합니다.",
    section: "customer-db",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/logs",
    riskLevel: "normal",
    status: "available",
    icon: Activity,
  },
  {
    id: "customer-data-quality",
    title: "고객 데이터 품질 점검",
    description:
      "전화번호 누락, 담당자 없음, 후속관리 공백, 중복 가능 고객 등 고객 DB의 보완 필요 항목을 확인합니다.",
    section: "customer-db",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/customer-data-quality",
    riskLevel: "normal",
    status: "available",
    icon: Database,
  },
  {
    id: "team-insights",
    title: "관리자 밀착 대시보드",
    description:
      "팀원별 미상담 DB, 후속관리 지연, 일정 미완료를 한눈에 확인합니다.",
    section: "team-work",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/team-insights",
    riskLevel: "normal",
    status: "available",
    icon: LayoutDashboard,
  },
  {
    id: "first-contact-sla",
    title: "첫 연락 SLA",
    description: "DB 배정 후 첫 연락이 지연되는 고객과 담당자를 확인합니다.",
    section: "team-work",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/admin/sla",
    riskLevel: "normal",
    status: "available",
    icon: Activity,
  },
  {
    id: "team-completion",
    title: "알림·후속관리 처리율",
    description: "팀원별 알림 처리율과 후속관리 완료율을 확인합니다.",
    section: "team-work",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/admin/team-completion",
    riskLevel: "normal",
    status: "available",
    icon: ClipboardCheck,
  },
  {
    id: "team-coaching",
    title: "코칭 메모",
    description: "팀원별 코칭 기록, 개선 행동, 다음 확인일을 관리합니다.",
    section: "team-work",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/admin/team-coaching",
    riskLevel: "normal",
    status: "beta",
    icon: ClipboardCheck,
  },
  {
    id: "onboarding-checklists",
    title: "온보딩 체크리스트",
    description:
      "신규 직원의 CRM 교육 항목, 진행률, 승인 대기 상태를 관리합니다.",
    section: "team-work",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/onboarding-checklists",
    riskLevel: "normal",
    status: "available",
    icon: ClipboardCheck,
  },
  {
    id: "aftercare-campaigns",
    title: "사후관리 캠페인",
    description:
      "계약 점검, 생일, 장기 미관리 고객을 사후관리 대상으로 확인하고 후속관리로 연결합니다. 자동 발송은 포함하지 않습니다.",
    section: "team-work",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/aftercare-campaigns",
    riskLevel: "normal",
    status: "available",
    icon: ClipboardCheck,
  },
  {
    id: "today-work-priority",
    title: "오늘의 업무 우선순위",
    description: "오늘 처리해야 할 업무를 긴급·오늘·일반 기준으로 정렬합니다.",
    section: "team-work",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/",
    riskLevel: "normal",
    status: "available",
    icon: Home,
  },
  {
    id: "operation-risk-dashboard",
    title: "운영 점검 대시보드",
    description:
      "운영 위험, 오류, 푸시 실패, 권한 차단 등 운영 상태를 점검합니다.",
    section: "operations-security",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/operation-risk",
    riskLevel: "normal",
    status: "production_ready",
    icon: ShieldCheck,
  },
  {
    id: "activity-logs",
    title: "활동 로그",
    description:
      "사용자별 조회, 수정, 삭제, 다운로드 등 주요 행동을 추적합니다.",
    section: "operations-security",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/logs",
    riskLevel: "normal",
    status: "available",
    icon: Activity,
  },
  {
    id: "operation-risk-report",
    title: "운영자용 장애·오류 리포트",
    description:
      "운영 위험, 오류, 푸시 실패, 권한 차단 등 운영 상태를 점검합니다.",
    section: "operations-security",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/operation-risk",
    riskLevel: "caution",
    status: "production_ready",
    icon: ShieldCheck,
  },
  {
    id: "download-reasons",
    title: "다운로드 사유 관리",
    description: "고객정보 다운로드 사유와 이력을 확인합니다.",
    section: "operations-security",
    allowedRoles: ["branch_admin"],
    route: "/download",
    riskLevel: "caution",
    status: "available",
    icon: Download,
  },
  {
    id: "risk-action-logs",
    title: "위험 작업 로그",
    description: "삭제, 복구, 계정 조작 등 민감 작업을 추적합니다.",
    section: "operations-security",
    allowedRoles: ["branch_admin"],
    route: "/operation-risk?tab=logs",
    riskLevel: "high",
    status: "branch_admin_only",
    icon: ShieldCheck,
  },
  {
    id: "delete-restore-permanent",
    title: "삭제·복구 관리",
    description: "삭제 요청, 복구, 완전삭제 가능 여부를 확인합니다.",
    section: "operations-security",
    allowedRoles: ["branch_admin"],
    route: "/deleted-data",
    riskLevel: "high",
    status: "branch_admin_only",
    icon: RotateCcw,
  },
  {
    id: "notifications-center",
    title: "알림센터",
    description: "생일, 계약 점검, 장기 미관리, 일정 미완료 알림을 확인합니다.",
    section: "notifications-push",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/notifications",
    riskLevel: "normal",
    status: "available",
    icon: Bell,
  },
  {
    id: "push-operations",
    title: "푸시 운영",
    description: "Android 앱 푸시 발송 결과와 실패·스킵 상태를 확인합니다.",
    section: "notifications-push",
    allowedRoles: ["branch_admin"],
    route: "/push-notifications",
    riskLevel: "normal",
    status: "available",
    icon: BellRing,
  },
  {
    id: "push-preferences",
    title: "푸시 알림 설정",
    description: "사용자별 앱 푸시 수신 설정과 조용한 시간대를 관리합니다.",
    section: "notifications-push",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/notification-preferences",
    riskLevel: "normal",
    status: "available",
    icon: BellRing,
  },
  {
    id: "push-logs",
    title: "발송 로그",
    description:
      "sent, failed, skipped 상태를 기준으로 푸시 이력을 확인합니다.",
    section: "notifications-push",
    allowedRoles: ["branch_admin"],
    route: "/push-notifications",
    riskLevel: "normal",
    status: "available",
    icon: BellRing,
  },
  {
    id: "push-skip-reasons",
    title: "미수신 원인 확인",
    description:
      "token 없음, 설정 OFF, 조용한 시간대, 중복 차단 여부를 확인합니다.",
    section: "notifications-push",
    allowedRoles: ["branch_admin"],
    route: "/push-notifications",
    riskLevel: "normal",
    status: "available",
    icon: BellRing,
  },
  {
    id: "performance-goals",
    title: "목표관리",
    description: "지점, 부지점, 팀, 개인별 목표를 등록하고 관리합니다.",
    section: "goals-performance",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/performance/goals",
    riskLevel: "normal",
    status: "available",
    icon: Target,
  },
  {
    id: "performance",
    title: "실적관리",
    description: "신규 계약, 월납보험료, 팀원별 실적 흐름을 확인합니다.",
    section: "goals-performance",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/performance",
    riskLevel: "normal",
    status: "available",
    icon: BarChart3,
  },
  {
    id: "work-rhythm",
    title: "업무 리듬 리포트",
    description:
      "상담, 후속관리, 일정, 실적 흐름을 업무 리듬 기준으로 확인합니다.",
    section: "goals-performance",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/performance/goals",
    riskLevel: "normal",
    status: "available",
    icon: BarChart3,
  },
  {
    id: "management-reports",
    title: "관리자 보고서",
    description:
      "일일·주간·월간 기준으로 팀장·부지점장 운영 보고서를 생성합니다.",
    section: "goals-performance",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    route: "/management-reports",
    riskLevel: "normal",
    status: "beta",
    icon: BarChart3,
  },
  {
    id: "goal-actions",
    title: "목표 대비 행동량",
    description:
      "목표 달성까지 필요한 상담, 후속관리, 계약 행동량을 확인합니다.",
    section: "goals-performance",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    riskLevel: "normal",
    status: "coming_soon",
    icon: Target,
    isComingSoon: true,
  },
  {
    id: "team-performance",
    title: "팀원별 실적 비교",
    description: "팀원별 실적과 고객관리 행동량을 함께 비교합니다.",
    section: "goals-performance",
    allowedRoles: ["branch_admin", "sub_branch_admin", "team_leader"],
    riskLevel: "normal",
    status: "coming_soon",
    icon: Users,
    isComingSoon: true,
  },
];

export function canAccessAdminOperationsCenter(user?: AdminHubUser | null) {
  if (!user || user.accountStatus !== "active") return false;
  return (
    user.role === "branch_admin" ||
    user.role === "sub_branch_admin" ||
    user.role === "team_leader"
  );
}

export function isCardVisibleForUser(
  card: AdminOperationCard,
  user?: AdminHubUser | null
) {
  if (!canAccessAdminOperationsCenter(user)) return false;
  const role = user!.role as ManagerRole;
  if (!card.allowedRoles.includes(role)) return false;
  if (card.status === "branch_admin_only" && role !== "branch_admin")
    return false;
  return true;
}

export function getVisibleAdminOperationCards(user?: AdminHubUser | null) {
  return ADMIN_OPERATION_CARDS.filter(card => isCardVisibleForUser(card, user));
}

export function groupAdminOperationCards(cards: AdminOperationCard[]) {
  return ADMIN_OPERATION_SECTIONS.map(section => ({
    ...section,
    cards: cards.filter(card => card.section === section.id),
  })).filter(section => section.cards.length > 0);
}

export function filterAdminOperationCards(
  cards: AdminOperationCard[],
  query: string
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return cards;
  return cards.filter(card => {
    const haystack = `${card.title} ${card.description}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function isHighRiskCard(card: AdminOperationCard) {
  return card.riskLevel === "high";
}

export function isCardNavigable(card: AdminOperationCard) {
  return card.status !== "coming_soon" && Boolean(card.route);
}

export function getCardStatusNotice(
  card: AdminOperationCard
): readonly string[] {
  if (card.status === "coming_soon" || card.isComingSoon)
    return COMING_SOON_NOTICE;
  if (card.status === "beta") return BETA_NOTICE;
  if (card.status === "production_ready") return PRODUCTION_READY_NOTICE;
  if (card.status === "branch_admin_only") return RESTRICTED_NOTICE;
  return AVAILABLE_NOTICE;
}
