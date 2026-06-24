import { PremiumStatCard } from "@/components/dashboard/PremiumStatCard";
import { canAccessRetentionRiskManagement } from "@/lib/retentionRiskPermissions";
import { trpc } from "@/lib/trpc";
import { CalendarClock, ShieldCheck, Users } from "lucide-react";
import { Link } from "wouter";

type RetentionRiskSummaryStripProps = {
  user: {
    role?: string | null;
    accountStatus?: string | null;
  } | null;
};

export function RetentionRiskSummaryStrip({
  user,
}: RetentionRiskSummaryStripProps) {
  const enabled = canAccessRetentionRiskManagement(user);
  const {
    data: summary,
    isLoading,
    isError,
    refetch,
  } = trpc.retentionRisk.summary.useQuery(undefined, { enabled });

  if (!enabled) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Link href="/retention-risk">
        <PremiumStatCard
          title="긴급 해지위험"
          value={summary?.criticalCount ?? 0}
          icon={ShieldCheck}
          tone="gold"
          helper="기록된 해지위험 상태"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
        />
      </Link>
      <Link href="/retention-risk">
        <PremiumStatCard
          title="다음 확인 예정"
          value={summary?.followUpScheduled ?? 0}
          icon={CalendarClock}
          tone="blue"
          helper="nextFollowUpAt 기준"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
        />
      </Link>
      <Link href="/retention-risk">
        <PremiumStatCard
          title="조정 검토 중"
          value={summary?.byRetentionStatus?.adjustment_review ?? 0}
          icon={Users}
          tone="green"
          helper="기록된 해지위험 상태"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
        />
      </Link>
    </div>
  );
}
