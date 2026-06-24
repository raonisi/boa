export type AssignmentCandidateAvailability = {
  selectable: boolean;
  disabledReason?: string;
};

export type AssignmentCandidateAvailabilityOptions = {
  isCurrentAssignee?: boolean;
};

export function getAssignmentCandidateAvailability(
  accountStatus?: string | null,
  options?: AssignmentCandidateAvailabilityOptions
): AssignmentCandidateAvailability {
  if (options?.isCurrentAssignee) {
    return {
      selectable: false,
      disabledReason: "현재 담당자입니다",
    };
  }

  if (accountStatus === "active") {
    return { selectable: true };
  }

  if (accountStatus === "inactive") {
    return {
      selectable: false,
      disabledReason: "비활성 계정입니다",
    };
  }

  if (accountStatus === "resigned") {
    return {
      selectable: false,
      disabledReason: "퇴사 처리된 사용자입니다",
    };
  }

  return {
    selectable: false,
    disabledReason: "현재 선택할 수 없는 사용자입니다",
  };
}
