import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Home, LockKeyhole, ShieldAlert } from "lucide-react";
import React from "react";

export function ForbiddenState({
  title = "권한이 필요한 화면입니다.",
  description = "접근 권한을 확인해 주세요. 필요한 경우 관리자에게 문의해 주세요.",
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
              <Button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                className="gap-2"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                홈으로 이동
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
                className="gap-2"
              >
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                이전 화면
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
