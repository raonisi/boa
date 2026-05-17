import { EmptyState } from "@/components/ui/empty-state";
import { Home, LockKeyhole, ShieldAlert } from "lucide-react";
import React from "react";

export function ForbiddenState({
  title = "접근 권한이 없습니다.",
  description = "이 화면은 현재 권한으로 사용할 수 없습니다. 필요한 경우 관리자에게 문의해 주세요.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        <EmptyState
          variant="forbidden"
          icon={LockKeyhole}
          title={title}
          description={description}
          className="border-solid bg-card p-6 shadow-sm sm:p-8"
          action={
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => { window.location.href = "/"; }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                홈으로 이동
              </button>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/70"
              >
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                이전 화면
              </button>
            </div>
          }
        />
      </div>
    </div>
  );
}
