export const OPERATION_RISK_ACTION_LEVEL_VALUES = [
  "immediate",
  "action_required",
  "informational",
] as const;

export type OperationRiskActionLevel =
  (typeof OPERATION_RISK_ACTION_LEVEL_VALUES)[number];

export const OPERATION_RISK_ACTION_LEVEL_LABELS: Record<
  OperationRiskActionLevel,
  string
> = {
  immediate: "즉시 확인",
  action_required: "처리 필요",
  informational: "참고",
};

export function classifyOperationRiskActionLevel(input: {
  immediateCount?: number;
  actionRequiredCount?: number;
}): OperationRiskActionLevel {
  if ((input.immediateCount ?? 0) > 0) return "immediate";
  if ((input.actionRequiredCount ?? 0) > 0) return "action_required";
  return "informational";
}

export function getOperationRiskActionLevelForStatus(
  status: string | null | undefined
): OperationRiskActionLevel {
  if (status === "conflict" || status === "failed") return "immediate";
  if (status === "pending") return "action_required";
  return "informational";
}

export function compareOperationRiskActionLevel(
  left: OperationRiskActionLevel,
  right: OperationRiskActionLevel
) {
  if (left === right) return 0;
  if (left === "immediate") return -1;
  if (right === "immediate") return 1;
  if (left === "action_required") return -1;
  return 1;
}

export function sortOperationRiskItems<
  T extends {
    actionLevel: OperationRiskActionLevel;
    createdAt?: string | Date | null;
    dueAt?: string | Date | null;
  },
>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const actionLevelOrder = compareOperationRiskActionLevel(
        left.item.actionLevel,
        right.item.actionLevel
      );
      if (actionLevelOrder !== 0) return actionLevelOrder;

      const leftDue = left.item.dueAt
        ? new Date(left.item.dueAt).getTime()
        : Number.POSITIVE_INFINITY;
      const rightDue = right.item.dueAt
        ? new Date(right.item.dueAt).getTime()
        : Number.POSITIVE_INFINITY;
      if (leftDue !== rightDue) return leftDue - rightDue;

      const leftCreated = left.item.createdAt
        ? new Date(left.item.createdAt).getTime()
        : 0;
      const rightCreated = right.item.createdAt
        ? new Date(right.item.createdAt).getTime()
        : 0;
      if (leftCreated !== rightCreated) return rightCreated - leftCreated;

      return left.index - right.index;
    })
    .map(({ item }) => item);
}
