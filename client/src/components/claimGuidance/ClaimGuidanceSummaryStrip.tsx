import { PremiumStatCard } from "@/components/dashboard/PremiumStatCard";
import { canAccessClaimGuidanceManagement } from "@/lib/claimGuidancePermissions";
import { trpc } from "@/lib/trpc";
import { CalendarClock, ClipboardList, HelpCircle } from "lucide-react";
import { Link } from "wouter";

type ClaimGuidanceSummaryStripProps = {
  user: {
    role?: string | null;
    accountStatus?: string | null;
  } | null;
};

export function ClaimGuidanceSummaryStrip({
  user,
}: ClaimGuidanceSummaryStripProps) {
  const enabled = canAccessClaimGuidanceManagement(user);
  const {
    data: summary,
    isLoading,
    isError,
    refetch,
  } = trpc.claimGuidance.summary.useQuery(undefined, { enabled });

  if (!enabled) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Link href="/claim-guidance">
        <PremiumStatCard
          title="안내 필요"
          value={summary?.guidanceNeeded ?? 0}
          icon={ClipboardList}
          tone="orange"
          helper="기록된 청구 안내"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
        />
      </Link>
      <Link href="/claim-guidance">
        <PremiumStatCard
          title="추가 안내 필요"
          value={summary?.additionalGuidanceNeeded ?? 0}
          icon={HelpCircle}
          tone="gold"
          helper="기록된 청구 안내"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
        />
      </Link>
      <Link href="/claim-guidance">
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
    </div>
  );
}
