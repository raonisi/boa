export const NOTIFICATION_CATEGORY_VALUES = [
  "all",
  "schedule",
  "customer_follow_up",
  "approval_admin",
  "system",
] as const;

export type NotificationCategory =
  (typeof NOTIFICATION_CATEGORY_VALUES)[number];

export const NOTIFICATION_SCHEDULE_TYPES = [
  "schedule_1day",
  "schedule_today",
  "schedule_1hour",
  "schedule_incomplete",
] as const;

export const NOTIFICATION_CUSTOMER_TYPES = [
  "birthday",
  "uncontacted_3days",
  "long_unmanaged_90",
  "reconsult",
  "customer_assigned",
] as const;

export const NOTIFICATION_CONTRACT_TYPES = [
  "contract_90",
  "contract_180",
  "contract_365",
  "unpaid_lapse",
] as const;

export const NOTIFICATION_CUSTOMER_ACTION_TYPES = [
  "uncontacted_3days",
  "long_unmanaged_90",
  "reconsult",
] as const;

export const NOTIFICATION_URGENT_TYPES = [
  "schedule_incomplete",
  "long_unmanaged_90",
  "unpaid_lapse",
  "reconsult",
  "uncontacted_3days",
] as const;

export const NOTIFICATION_TODAY_TYPES = [
  "schedule_today",
  "schedule_1hour",
  "birthday",
] as const;

export const NOTIFICATION_PRIORITY_FILTER_VALUES = [
  "urgent",
  "today",
  "general",
  "done",
] as const;

export type NotificationPriority = "urgent" | "today" | "general";
export type NotificationPriorityFilter =
  (typeof NOTIFICATION_PRIORITY_FILTER_VALUES)[number];

export type NotificationTargetInput = {
  type?: string | null;
  relatedType?: string | null;
  relatedId?: number | null;
  targetAvailable?: boolean | null;
};

export type NotificationActionCenterItem = NotificationTargetInput & {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  dueAt?: string | Date | null;
  isRead: boolean;
  processStatus: string;
  createdAt: string | Date;
  category: Exclude<NotificationCategory, "all">;
  actionRequired: boolean;
  sourceAvailable: boolean;
  sourceStatus: string | null;
  priority?: NotificationPriorityFilter;
};

export type NotificationTarget = {
  kind:
    | "customer"
    | "contract"
    | "schedule"
    | "follow_up"
    | "schedule_change_request"
    | "delete_request";
  label: string;
  path: string;
  basePath: string;
};

function hasPositiveId(value: number | null | undefined): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

export function classifyNotificationCategory(input: {
  type?: string | null;
  relatedType?: string | null;
}): Exclude<NotificationCategory, "all"> {
  const type = input.type ?? "";
  const relatedType = input.relatedType ?? "";

  if (
    relatedType === "schedule" ||
    (NOTIFICATION_SCHEDULE_TYPES as readonly string[]).includes(type)
  ) {
    return "schedule";
  }
  if (
    relatedType === "schedule_change_request" ||
    relatedType === "delete_request"
  ) {
    return "approval_admin";
  }
  if (
    ["customer", "follow_up", "contract"].includes(relatedType) ||
    (NOTIFICATION_CUSTOMER_TYPES as readonly string[]).includes(type) ||
    (NOTIFICATION_CONTRACT_TYPES as readonly string[]).includes(type)
  ) {
    return "customer_follow_up";
  }
  return "system";
}

export function resolveNotificationTarget(
  input: NotificationTargetInput,
  actorRole?: string | null
): NotificationTarget | null {
  if (input.targetAvailable === false) return null;

  const relatedId = input.relatedId;
  switch (input.relatedType) {
    case "customer":
      if (!hasPositiveId(relatedId)) return null;
      if (
        ["uncontacted_3days", "long_unmanaged_90", "reconsult"].includes(
          input.type ?? ""
        )
      ) {
        return {
          kind: "customer",
          label: "후속관리 처리",
          path: `/customers/${relatedId}?action=quick-followup`,
          basePath: "/customers/:id",
        };
      }
      return {
        kind: "customer",
        label: "고객 보기",
        path: `/customers/${relatedId}`,
        basePath: "/customers/:id",
      };
    case "contract":
      if (!hasPositiveId(relatedId)) return null;
      return {
        kind: "contract",
        label: "계약 보기",
        path: "/contracts",
        basePath: "/contracts",
      };
    case "schedule":
      if (!hasPositiveId(relatedId)) return null;
      return {
        kind: "schedule",
        label: "일정 보기",
        path: "/calendar",
        basePath: "/calendar",
      };
    case "follow_up":
      if (!hasPositiveId(relatedId)) return null;
      return {
        kind: "follow_up",
        label: "후속관리 보기",
        path: "/customers?action=quick-followup",
        basePath: "/customers",
      };
    case "schedule_change_request":
      if (
        !hasPositiveId(relatedId) ||
        !["branch_admin", "sub_branch_admin", "team_leader"].includes(
          actorRole ?? ""
        )
      ) {
        return null;
      }
      return {
        kind: "schedule_change_request",
        label: "일정 요청 보기",
        path: "/schedule-change-requests",
        basePath: "/schedule-change-requests",
      };
    case "delete_request":
      if (!hasPositiveId(relatedId) || actorRole !== "branch_admin")
        return null;
      return {
        kind: "delete_request",
        label: "삭제 요청 보기",
        path: "/deleted-data",
        basePath: "/deleted-data",
      };
    default:
      return null;
  }
}

export function getNotificationActionCopy(input: {
  actionRequired?: boolean | null;
  sourceAvailable?: boolean | null;
  sourceStatus?: string | null;
  relatedType?: string | null;
}) {
  if (input.relatedType && input.sourceAvailable === false) {
    return "처리 대상을 확인할 수 없습니다.";
  }
  if (input.actionRequired) {
    if (input.sourceStatus === "conflict")
      return "원본 변경 충돌을 확인해야 합니다.";
    if (input.sourceStatus === "failed")
      return "반영 실패 원인을 확인해야 합니다.";
    if (input.sourceStatus === "pending")
      return "원본 업무가 처리 대기 중입니다.";
    return "원본 업무에서 후속 조치가 필요합니다.";
  }
  return input.sourceStatus
    ? `원본 업무 상태: ${input.sourceStatus}`
    : "확인용 알림입니다.";
}
