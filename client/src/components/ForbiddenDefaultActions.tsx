import { Button } from "@/components/ui/button";
import { FORBIDDEN_UX } from "@/lib/userFacingMessages";
import { Home, ShieldAlert } from "lucide-react";
import React from "react";

export function ForbiddenDefaultActions() {
  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
      <Button
        type="button"
        onClick={() => {
          window.location.href = "/";
        }}
        className="gap-2"
      >
        <Home className="h-4 w-4" aria-hidden="true" />
        {FORBIDDEN_UX.dashboardLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => window.history.back()}
        className="gap-2"
      >
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        {FORBIDDEN_UX.backLabel}
      </Button>
    </div>
  );
}
