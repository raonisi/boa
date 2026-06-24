export type AssignmentCandidateAvailability = {
  selectable: boolean;
  disabledReason?: string;
};

export function getAssignmentCandidateAvailability(
  accountStatus?: string | null
): AssignmentCandidateAvailability {
  if (accountStatus === "active") {
    return { selectable: true };
  }

  return {
    selectable: false,
    disabledReason: "선택할 수 없는 계정 상태입니다",
  };
}
