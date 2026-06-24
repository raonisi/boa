import { PremiumStatCard } from "@/components/dashboard/PremiumStatCard";
import { canAccessReferralManagement } from "@/lib/referralFlowPermissions";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, GitBranch, HeartHandshake } from "lucide-react";
import { Link } from "wouter";

type ReferralSummaryStripProps = {
  user: {
    role?: string | null;
    accountStatus?: string | null;
  } | null;
};

export function ReferralSummaryStrip({ user }: ReferralSummaryStripProps) {
  const enabled = canAccessReferralManagement(user);
  const {
    data: summary,
    isLoading,
    isError,
    refetch,
  } = trpc.customerReferrals.summary.useQuery(undefined, { enabled });

  if (!enabled) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Link href="/referrals">
        <PremiumStatCard
          title="진행 중 소개"
          value={summary?.inProgress ?? 0}
          icon={GitBranch}
          tone="blue"
          helper="기록된 소개 흐름"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
        />
      </Link>
      <Link href="/referrals">
        <PremiumStatCard
          title="감사 연락 미완료"
          value={summary?.thankYouPending ?? 0}
          icon={HeartHandshake}
          tone="gold"
          helper="감사 pending 기준"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
        />
      </Link>
      <Link href="/referrals">
        <PremiumStatCard
          title="계약 완료 소개"
          value={summary?.contracted ?? 0}
          icon={CheckCircle2}
          tone="green"
          helper="resultStatus=contracted"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
        />
      </Link>
    </div>
  );
}
