import { useAuth } from "@/_core/hooks/useAuth";
import { ForbiddenState } from "@/components/ForbiddenState";
import { canAccessRoutePath } from "@/lib/routeAccess";
import { Loader2 } from "lucide-react";
import React from "react";

export function RouteAccessGuard({
  path,
  children,
}: {
  path: string;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccessRoutePath(path, user)) {
    return <ForbiddenState />;
  }

  return <>{children}</>;
}
