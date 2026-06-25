import { Button } from "@/components/ui/button";
import { WORKFLOW_COPY } from "@/lib/assignmentWorkflowCopy";
import { MOBILE_FIXED_ABOVE_NAV_BOTTOM } from "@/lib/mobileLayout";
import { UserPlus, Users, X } from "lucide-react";
import React from "react";

type WorkflowKind = "dbAssignment" | "dbDistribution";

export function CustomerAssignMobileActionBar({
  selectedCount,
  canExecute,
  workflowKind,
  actionLabel,
  helperText,
  pending,
  onExecute,
  onClearSelection,
}: {
  selectedCount: number;
  canExecute: boolean;
  workflowKind: WorkflowKind;
  actionLabel: string;
  helperText?: string;
  pending: boolean;
  onExecute: () => void;
  onClearSelection: () => void;
}) {
  if (selectedCount <= 0) return null;

  const workflowTitle =
    workflowKind === "dbDistribution"
      ? WORKFLOW_COPY.dbDistribution.confirmTitle.replace(" 확인", "")
      : WORKFLOW_COPY.dbAssignment.title;

  const Icon = workflowKind === "dbDistribution" ? Users : UserPlus;

  return (
    <div
      className="fixed inset-x-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      style={{ bottom: MOBILE_FIXED_ABOVE_NAV_BOTTOM }}
      role="region"
      aria-label="선택 고객 일괄 작업"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            선택한 고객 {selectedCount}명
          </p>
          <p className="text-xs text-muted-foreground">
            {workflowTitle}
            {helperText ? ` · ${helperText}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={onClearSelection}
            disabled={pending}
          >
            <X className="mr-1 h-4 w-4" aria-hidden="true" />
            선택 해제
          </Button>
          <Button
            type="button"
            size="sm"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={!canExecute || pending}
            onClick={onExecute}
          >
            <Icon className="mr-1 h-4 w-4" aria-hidden="true" />
            {pending ? "처리 중..." : actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
