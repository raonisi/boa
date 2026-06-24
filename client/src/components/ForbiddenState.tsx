import { EmptyState } from "@/components/ui/empty-state";
import { FORBIDDEN_UX } from "@/lib/userFacingMessages";
import React from "react";

import { ForbiddenDefaultActions } from "./ForbiddenDefaultActions";

export function ForbiddenState({
  title = FORBIDDEN_UX.title,
  description = FORBIDDEN_UX.description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        <EmptyState
          variant="forbidden"
          title={title}
          description={description}
          className="border-solid bg-card p-6 shadow-sm sm:p-8"
          action={<ForbiddenDefaultActions />}
        />
      </div>
    </div>
  );
}
