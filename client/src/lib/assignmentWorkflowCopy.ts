export const WORKFLOW_COPY = {
  dbAssignment: {
    title: "DB 배정",
    description:
      "배정할 고객과 담당자를 선택합니다. 고객 관리 책임과 접근 범위는 현재 권한 정책에 따라 반영됩니다.",
    confirmTitle: "DB 배정 확인",
    confirmDescription:
      "선택한 고객 DB를 지정 담당자에게 배정합니다. 권한과 상태는 서버에서 다시 검증됩니다.",
    confirmButton: "배정 확정",
    cancelButton: "취소",
    currentAssigneeLabel: "현재 담당자",
    unassignedLabel: "미배정",
    postAssigneeNote:
      "배정 후 선택한 담당자가 고객 관리 책임자가 됩니다. 기존 담당자가 없는 DB 배정 업무입니다.",
  },
  dbDistribution: {
    confirmTitle: "DB 배분 확인",
    confirmDescription:
      "선택한 고객 DB를 지정 부지점장에게 배분합니다. 이후 산하 조직에서 담당자를 배정할 수 있습니다.",
    confirmButton: "배정 확정",
  },
  reassignment: {
    title: "담당자 재지정",
    description:
      "기존 담당 고객의 관리 책임자를 변경합니다. 변경 이력은 유지되며, 전 담당자의 접근 범위는 권한 정책에 따라 다시 적용됩니다.",
    confirmTitle: "담당자 재지정 확인",
    confirmDescription:
      "선택한 고객의 관리 책임자를 변경합니다. 서버에서 권한 범위를 다시 검증합니다.",
    confirmButton: "재지정 확정",
    cancelButton: "취소",
    historyNote: "변경 이력은 유지됩니다.",
    accessNote:
      "전 담당자의 접근 범위는 권한 정책에 따라 다시 적용됩니다.",
    historyPathNote:
      "변경 이력은 고객 상세의 배정 이력에서 확인할 수 있습니다.",
  },
  handoff: {
    title: "고객 인수인계",
    description:
      "퇴사·휴직·조직 변경 등으로 고객 관련 업무를 구조적으로 이전합니다. 고객, 계약, 일정, 후속관리, 알림 등 이전 범위를 확인한 뒤 실행하세요.",
    confirmTitle: "인수인계 실행 확인",
    confirmButton: "인수인계 실행",
    cancelButton: "취소",
    historyPathNote:
      "이전된 고객과 업무 범위는 인수인계 이력에서 확인할 수 있습니다.",
    rollbackNote:
      "실행 후 되돌리려면 별도 재이관이 필요합니다. 기존 상담기록과 활동 로그는 감사 추적을 위해 변경하지 않습니다.",
    accessNote:
      "인계자의 계정 상태와 접근권한은 선택한 보안 조치에 따라 처리됩니다.",
  },
} as const;

type AssigneeSummaryCustomer = {
  id: number;
  agentId?: number | null;
};

export function summarizeCurrentAssignees(
  customerIds: number[],
  customers: AssigneeSummaryCustomer[],
  formatAgent: (agentId: number) => string
): string {
  const selected = customers.filter(customer =>
    customerIds.includes(customer.id)
  );
  const agentIds = Array.from(
    new Set(
      selected
        .map(customer => customer.agentId)
        .filter((agentId): agentId is number => typeof agentId === "number")
    )
  );

  if (selected.length === 0) return "-";
  if (agentIds.length === 0) return WORKFLOW_COPY.dbAssignment.unassignedLabel;
  if (agentIds.length === 1) {
    return formatAgent(agentIds[0]);
  }
  return `${agentIds.length}명의 담당자에게 분산`;
}

export function formatDbAssignmentSuccessMessage(input: {
  successCount: number;
  targetLabel: string;
  failedCount?: number;
}): string {
  if (input.successCount <= 0) {
    return "배정된 고객이 없습니다. 실패 항목을 확인해 주세요.";
  }
  const base = `고객 ${input.successCount}건을 ${input.targetLabel} 담당자에게 배정했습니다.`;
  if (!input.failedCount) return base;
  return `${base} (실패 ${input.failedCount}건)`;
}

export function formatReassignmentSuccessMessage(input: {
  changedCount: number;
  newAssigneeLabel: string;
  previousAssigneeLabel?: string;
  skippedCount?: number;
}): string {
  const skippedSuffix =
    input.skippedCount && input.skippedCount > 0
      ? ` (${input.skippedCount}건 제외)`
      : "";
  if (input.previousAssigneeLabel) {
    return `고객 ${input.changedCount}건의 담당자를 ${input.previousAssigneeLabel}에서 ${input.newAssigneeLabel}로 변경했습니다.${skippedSuffix} ${WORKFLOW_COPY.reassignment.historyPathNote}`;
  }
  return `고객 ${input.changedCount}건의 담당자를 ${input.newAssigneeLabel}로 변경했습니다.${skippedSuffix} ${WORKFLOW_COPY.reassignment.historyPathNote}`;
}

export function formatHandoffSuccessMessage(): string {
  return `인수인계가 완료되었습니다. ${WORKFLOW_COPY.handoff.historyPathNote}`;
}
