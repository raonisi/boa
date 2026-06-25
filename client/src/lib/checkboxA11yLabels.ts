export type CheckboxRowSurface = "customer" | "notification";

export type CheckboxRowWorkflow = "assign";

/** Safe row-scoped checkbox labels — no customer names, phones, or message bodies. */
export function getPageRowSelectionLabel(input: {
  surface: CheckboxRowSurface;
  rowIndex: number;
  workflow?: CheckboxRowWorkflow;
}): string {
  const rowNumber = Math.max(1, input.rowIndex);
  if (input.surface === "customer") {
    if (input.workflow === "assign") {
      return `현재 페이지 배정 대상 고객 ${rowNumber}번 행 선택`;
    }
    return `현재 페이지 고객 ${rowNumber}번 행 선택`;
  }
  return `현재 페이지 알림 ${rowNumber}번 행 선택`;
}

export function getPageSelectAllLabel(input: {
  surface: CheckboxRowSurface;
  workflow?: CheckboxRowWorkflow;
}): string {
  if (input.surface === "customer") {
    if (input.workflow === "assign") {
      return "현재 페이지 배정 대상 고객 전체 선택";
    }
    return "현재 페이지 고객 전체 선택";
  }
  return "현재 페이지 알림 전체 선택";
}
