import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  active: "활성",
  inactive: "비활성",
  resigned: "퇴사자",
  scheduled: "예정",
  postponed: "연기",
  completed: "완료",
  cancelled: "취소",
  pending: "대기",
  approved: "승인",
  rejected: "반려",
  failed: "실패",
  success: "성공",
  sent: "성공",
  skipped: "스킵",
};

const statusColors: Record<string, string> = {
  미상담: "bg-gray-100 text-gray-700",
  부재: "bg-orange-100 text-orange-700",
  통화완료: "bg-blue-100 text-blue-700",
  상담예정: "bg-purple-100 text-purple-700",
  설계중: "bg-indigo-100 text-indigo-700",
  계약: "bg-green-100 text-green-700",
  보류: "bg-yellow-100 text-yellow-700",
  거절: "bg-red-100 text-red-700",
  해지관리: "bg-rose-100 text-rose-700",
  재상담필요: "bg-teal-100 text-teal-700",
  // Contract status
  청약: "bg-sky-100 text-sky-700",
  성립: "bg-green-100 text-green-700",
  철회: "bg-orange-100 text-orange-700",
  유지: "bg-emerald-100 text-emerald-700",
  해지: "bg-red-100 text-red-700",
  // Payment status
  정상: "bg-green-100 text-green-700",
  미납: "bg-orange-100 text-orange-700",
  실효: "bg-red-100 text-red-700",
  // Schedule status
  예정: "bg-blue-100 text-blue-700",
  완료: "bg-green-100 text-green-700",
  취소: "bg-gray-100 text-gray-500",
  변경: "bg-yellow-100 text-yellow-700",
  노쇼: "bg-red-100 text-red-700",
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  resigned: "bg-red-100 text-red-700",
  scheduled: "bg-blue-100 text-blue-700",
  postponed: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  success: "bg-green-100 text-green-700",
  sent: "bg-green-100 text-green-700",
  skipped: "bg-slate-100 text-slate-700",
};

export function getStatusLabel(status: string | null | undefined) {
  if (!status) return "상태 미지정";
  if (statusLabels[status]) return statusLabels[status];
  return /^[a-z][a-z0-9_:-]*$/i.test(status) ? "기타 상태" : status;
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const color = statusColors[status] ?? "bg-gray-100 text-gray-600";
  const label = getStatusLabel(status);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        color,
        className
      )}
    >
      {label}
    </span>
  );
}

export const CONSULT_STATUSES = [
  "미상담",
  "부재",
  "통화완료",
  "상담예정",
  "설계중",
  "계약",
  "보류",
  "거절",
  "해지관리",
  "재상담필요",
] as const;

export const SCHEDULE_TYPES = [
  "고객상담",
  "재통화",
  "계약예정",
  "보장분석",
  "해지방어",
  "팀회의",
  "교육",
  "외근",
  "휴무",
  "기타",
] as const;

export const SCHEDULE_STATUSES = [
  "예정",
  "완료",
  "취소",
  "변경",
  "노쇼",
  "보류",
] as const;
