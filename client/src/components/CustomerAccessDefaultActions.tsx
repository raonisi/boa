import { Button } from "@/components/ui/button";
import { CUSTOMER_ACCESS_UX } from "@/lib/userFacingMessages";
import { ArrowLeft, Users } from "lucide-react";
import React from "react";

type CustomerAccessDefaultActionsProps = {
  onRetry?: () => void;
  showRetry?: boolean;
};

export function CustomerAccessDefaultActions({
  onRetry,
  showRetry = false,
}: CustomerAccessDefaultActionsProps) {
  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
      <Button
        type="button"
        onClick={() => {
          window.location.href = "/customers";
        }}
        className="min-h-11 gap-2"
      >
        <Users className="h-4 w-4" aria-hidden="true" />
        {CUSTOMER_ACCESS_UX.listActionLabel}
      </Button>
      {showRetry && onRetry ? (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          className="min-h-11"
        >
          다시 시도
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        onClick={() => window.history.back()}
        className="min-h-11 gap-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {CUSTOMER_ACCESS_UX.backLabel}
      </Button>
    </div>
  );
}
