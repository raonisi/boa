import { useAuth } from "@/_core/hooks/useAuth";
import { ForbiddenState } from "@/components/ForbiddenState";
import { canAccessRoutePath } from "@/lib/routeAccess";
import React from "react";

export function RouteAccessGuard({
  path,
  children,
}: {
  path: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  if (!canAccessRoutePath(path, user)) {
    return <ForbiddenState />;
  }

  return <>{children}</>;
}
