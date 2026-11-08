import React from "react";

export type PostConsultPromptData = {
  customerId: number;
  hasCalendarSchedule: boolean;
  nextContactAt?: string;
  nextAction?: string;
  token?: string;
  generation?: number;
};

type PostConsultFollowupPromptProps = {
  prompt: PostConsultPromptData;
  openFollowUpsCount: number;
  onOpenFollowUp: () => void;
  onDismiss: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
};

export default function PostConsultFollowupPrompt({
  prompt,
  openFollowUpsCount,
  onOpenFollowUp,
  onDismiss,
  triggerRef,
}: PostConsultFollowupPromptProps) {
  return (
    <div
      role="region"
      aria-label="상담 저장 후 후속관리 안내"
      data-testid="post-consult-followup-prompt"
      className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/40"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8 2v4M16 2v4M3 10h18M3 4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4zM12 14v6M9 17h6" />
              </svg>
            </span>
            <p className="font-semibold text-sm text-blue-950 dark:text-blue-100">
              상담기록이 저장되었습니다.
            </p>
            {prompt.hasCalendarSchedule && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                캘린더 일정 등록됨
              </span>
            )}
            {openFollowUpsCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                기존 후속관리 {openFollowUpsCount}건
              </span>
            )}
          </div>
          <p className="text-xs text-blue-800/90 dark:text-blue-200/90 leading-relaxed">
            다음 연락이 필요하다면 후속관리로 이어서 등록할 수 있습니다.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            ref={triggerRef}
            data-testid="post-consult-create-followup-button"
            className="inline-flex min-h-11 md:min-h-9 items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={onOpenFollowUp}
          >
            <svg
              className="mr-1 h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8 2v4M16 2v4M3 10h18M3 4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4zM12 14v6M9 17h6" />
            </svg>
            후속관리 등록
          </button>
          <button
            type="button"
            data-testid="post-consult-dismiss-button"
            className="inline-flex min-h-11 md:min-h-9 items-center justify-center rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-slate-900 dark:text-slate-200"
            onClick={onDismiss}
          >
            나중에 처리
          </button>
        </div>
      </div>
    </div>
  );
}
