export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  unassigned: "미배정",
  assigned_to_sub_branch: "부지점장 배분됨",
  assigned_to_agent: "담당자 배정됨",
  assigned: "배정됨",
  reclaimed: "회수됨",
};

export function formatAssignmentStatusLabel(
  assignmentStatus?: string | null
): string {
  if (!assignmentStatus) return ASSIGNMENT_STATUS_LABELS.unassigned;
  return ASSIGNMENT_STATUS_LABELS[assignmentStatus] ?? assignmentStatus;
}
