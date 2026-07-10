import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getRoleLabel } from "@/lib/userRole";
import { toastUserFacingError } from "@/lib/userFacingMessages";
import { cn } from "@/lib/utils";
import {
  SCHEDULE_CHANGE_REQUEST_STATUSES,
  SCHEDULE_CHANGE_REQUEST_STATUS_LABELS,
  SCHEDULE_CHANGE_REQUEST_TYPES,
  SCHEDULE_CHANGE_REQUEST_TYPE_LABELS,
  type ScheduleChangeRequestStatus,
  type ScheduleChangeRequestType,
} from "@shared/scheduleChangeRequest";
import { formatKstLocalDateTime } from "@shared/timePolicy";
import type { inferRouterOutputs } from "@trpc/server";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FilterX,
  History,
  Loader2,
  RefreshCw,
  UserRound,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { VariantProps } from "class-variance-authority";
import type { AppRouter } from "../../../server/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ScheduleRequestView =
  RouterOutputs["scheduleChangeRequests"]["listAdmin"][number];
type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
type FilterValue = "all" | string;
type ConfirmationAction = "approve" | "cancel" | null;

type RequestFilters = {
  requestType: FilterValue;
  status: FilterValue;
  requesterId: FilterValue;
  targetUserId: FilterValue;
  dateFrom: string;
  dateTo: string;
};

const INITIAL_FILTERS: RequestFilters = {
  requestType: "all",
  status: "all",
  requesterId: "all",
  targetUserId: "all",
  dateFrom: "",
  dateTo: "",
};

const STATUS_VARIANTS: Record<ScheduleChangeRequestStatus, BadgeVariant> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "neutral",
  conflict: "warning",
  failed: "destructive",
};

const COMPARE_FIELDS = [
  ["title", "일정 제목"],
  ["type", "일정 유형"],
  ["status", "진행 상태"],
  ["startTime", "시작 시간"],
  ["endTime", "종료 시간"],
  ["location", "장소"],
  ["description", "상세 설명"],
  ["memo", "메모"],
  ["customerId", "고객 연결"],
  ["reminderOffsetMinutes", "알림"],
  ["calendarCategory", "캘린더 구분"],
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatDateTime(value?: Date | string | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return formatKstLocalDateTime(date, { seconds: false }).replace("T", " ");
}

function formatFieldValue(key: string, value: unknown) {
  if (value === undefined) return "변경 없음";
  if (value === null || value === "") return "없음";
  if (key === "startTime" || key === "endTime") {
    return formatDateTime(value as Date | string);
  }
  if (key === "customerId") {
    return Number(value) > 0 ? "고객 연결 있음" : "고객 연결 없음";
  }
  if (key === "reminderOffsetMinutes") {
    const minutes = Number(value);
    if (minutes < 0) return "알림 없음";
    if (minutes === 0) return "시작 시각";
    if (minutes >= 1440) return `${minutes / 1440}일 전`;
    if (minutes >= 60) return `${minutes / 60}시간 전`;
    return `${minutes}분 전`;
  }
  if (typeof value === "boolean") return value ? "예" : "아니오";
  return String(value);
}

function getRequestTitle(request: ScheduleRequestView) {
  const requested = asRecord(request.requestedPayload);
  const before = asRecord(request.beforeSnapshot);
  const current = asRecord(request.currentSchedule);
  const title = requested.title ?? before.title ?? current.title;
  return typeof title === "string" && title.trim() ? title : "일정 정보";
}

function requestTargetLabel(request: ScheduleRequestView) {
  if (!request.targetUser) return "담당자 정보 없음";
  return `${request.targetUser.name ?? "이름 미등록"} · ${getRoleLabel(request.targetUser.role)}`;
}

function requestTypeIcon(type: ScheduleChangeRequestType) {
  if (type === "create") return CalendarClock;
  if (type === "update") return RefreshCw;
  return XCircle;
}

function RequestStatusBadge({
  status,
}: {
  status: ScheduleChangeRequestStatus;
}) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {SCHEDULE_CHANGE_REQUEST_STATUS_LABELS[status]}
    </Badge>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Clock3;
  tone: string;
}) {
  return (
    <Card className="min-w-0 gap-3 py-4">
      <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="min-w-0">
          <CardDescription className="text-xs font-medium">
            {label}
          </CardDescription>
          <CardTitle className="mt-2 text-2xl tabular-nums">{value}</CardTitle>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            tone
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardHeader>
    </Card>
  );
}

function RequestMeta({
  request,
  isAdmin,
}: {
  request: ScheduleRequestView;
  isAdmin: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-1 text-xs text-muted-foreground">
      {isAdmin ? (
        <span className="truncate">
          요청자 {request.requester?.name ?? "이름 미등록"}
        </span>
      ) : null}
      <span className="truncate">대상 {requestTargetLabel(request)}</span>
      <span className="tabular-nums">{formatDateTime(request.createdAt)}</span>
    </div>
  );
}

function MobileRequestItem({
  request,
  isAdmin,
  onOpen,
}: {
  request: ScheduleRequestView;
  isAdmin: boolean;
  onOpen: () => void;
}) {
  const Icon = requestTypeIcon(request.requestType);
  return (
    <article className="min-w-0 rounded-lg border border-border/90 bg-card p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {getRequestTitle(request)}
            </p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {SCHEDULE_CHANGE_REQUEST_TYPE_LABELS[request.requestType]}
            </p>
          </div>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>
      <div className="mt-3 border-t border-border/70 pt-3">
        <RequestMeta request={request} isAdmin={isAdmin} />
        <p className="mt-2 line-clamp-2 break-words text-sm leading-5">
          {request.reason}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="mt-4 w-full"
        onClick={onOpen}
      >
        상세 확인
      </Button>
    </article>
  );
}

function ComparisonTable({ request }: { request: ScheduleRequestView }) {
  const before = asRecord(request.beforeSnapshot);
  const requested = asRecord(request.requestedPayload);
  const current = asRecord(request.currentSchedule);
  const rows = COMPARE_FIELDS.filter(([key]) => {
    if (request.requestType === "update") {
      return Object.prototype.hasOwnProperty.call(requested, key);
    }
    if (request.requestType === "create") {
      return Object.prototype.hasOwnProperty.call(requested, key);
    }
    return [
      "title",
      "type",
      "status",
      "startTime",
      "endTime",
      "location",
    ].includes(key);
  });

  if (rows.length === 0) {
    return (
      <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        비교할 상세 변경값이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[680px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">항목</TableHead>
            <TableHead>요청 전</TableHead>
            <TableHead>요청 값</TableHead>
            <TableHead>현재 값</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(([key, label]) => (
            <TableRow key={key}>
              <TableCell className="font-medium">{label}</TableCell>
              <TableCell className="max-w-56 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {request.requestType === "create"
                  ? "신규"
                  : formatFieldValue(key, before[key])}
              </TableCell>
              <TableCell className="max-w-56 whitespace-pre-wrap break-words text-sm">
                {request.requestType === "delete"
                  ? "삭제"
                  : formatFieldValue(key, requested[key])}
              </TableCell>
              <TableCell className="max-w-56 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {formatFieldValue(key, current[key])}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RequestDetailDialog({
  requestId,
  isAdmin,
  onClose,
  reviewComment,
  onReviewCommentChange,
  onApprove,
  onReject,
  onCancel,
  mutationPending,
}: {
  requestId: number | null;
  isAdmin: boolean;
  onClose: () => void;
  reviewComment: string;
  onReviewCommentChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  mutationPending: boolean;
}) {
  const detailQuery = trpc.scheduleChangeRequests.getDetail.useQuery(
    { id: requestId ?? 1 },
    { enabled: requestId !== null }
  );
  const request = detailQuery.data;
  const pending = request?.status === "pending";

  return (
    <Dialog open={requestId !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-4xl gap-5 p-4 sm:p-6">
        <DialogHeader className="pr-10">
          <DialogTitle>일정 변경 요청 상세</DialogTitle>
          <DialogDescription>
            요청 내용과 현재 일정을 비교한 뒤 처리 상태를 확인합니다.
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading ? (
          <LoadingState compact title="요청 내용을 불러오는 중입니다." />
        ) : detailQuery.isError || !request ? (
          <ErrorState
            compact
            title="요청 내용을 불러오지 못했습니다."
            description="잠시 후 다시 시도해 주세요."
            onRetry={() => detailQuery.refetch()}
          />
        ) : (
          <div className="space-y-5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant="outline">
                {SCHEDULE_CHANGE_REQUEST_TYPE_LABELS[request.requestType]}
              </Badge>
              <RequestStatusBadge status={request.status} />
              <span className="min-w-0 truncate text-sm font-semibold">
                {getRequestTitle(request)}
              </span>
            </div>

            <dl className="grid gap-3 rounded-lg bg-muted/35 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">요청자</dt>
                <dd className="mt-1 truncate font-medium">
                  {request.requester?.name ?? "이름 미등록"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">대상 담당자</dt>
                <dd className="mt-1 truncate font-medium">
                  {requestTargetLabel(request)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">요청 시각</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {formatDateTime(request.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">처리 시각</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {formatDateTime(request.reviewedAt ?? request.cancelledAt)}
                </dd>
              </div>
            </dl>

            <section
              aria-labelledby="request-reason-title"
              className="space-y-2"
            >
              <h3 id="request-reason-title" className="text-sm font-semibold">
                요청 사유
              </h3>
              <p className="whitespace-pre-wrap break-words rounded-lg border-l-4 border-primary/40 bg-primary/[0.04] px-4 py-3 text-sm leading-6">
                {request.reason}
              </p>
            </section>

            <section
              aria-labelledby="request-comparison-title"
              className="space-y-2"
            >
              <h3
                id="request-comparison-title"
                className="text-sm font-semibold"
              >
                일정 변경 비교
              </h3>
              <ComparisonTable request={request} />
            </section>

            {request.reviewComment ? (
              <section
                aria-labelledby="review-comment-title"
                className="space-y-2"
              >
                <h3 id="review-comment-title" className="text-sm font-semibold">
                  처리 의견
                </h3>
                <p className="whitespace-pre-wrap break-words rounded-lg bg-muted/50 px-4 py-3 text-sm">
                  {request.reviewComment}
                </p>
              </section>
            ) : null}

            {isAdmin && pending ? (
              <section
                aria-labelledby="review-input-title"
                className="space-y-2"
              >
                <h3 id="review-input-title" className="text-sm font-semibold">
                  반려 사유
                </h3>
                <Textarea
                  value={reviewComment}
                  onChange={event => onReviewCommentChange(event.target.value)}
                  placeholder="반려할 경우 요청자가 이해할 수 있는 사유를 입력해 주세요."
                  maxLength={500}
                  disabled={mutationPending}
                />
                <p className="text-right text-xs text-muted-foreground tabular-nums">
                  {reviewComment.length}/500
                </p>
              </section>
            ) : null}
          </div>
        )}

        {request && pending ? (
          <DialogFooter className="sticky bottom-0 -mx-4 -mb-4 border-t bg-background/96 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
            {isAdmin ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onReject}
                  disabled={mutationPending || !reviewComment.trim()}
                >
                  {mutationPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <XCircle />
                  )}
                  반려
                </Button>
                <Button
                  type="button"
                  onClick={onApprove}
                  disabled={mutationPending}
                >
                  {mutationPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <CheckCircle2 />
                  )}
                  승인 및 반영
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="destructive"
                onClick={onCancel}
                disabled={mutationPending}
              >
                {mutationPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <XCircle />
                )}
                요청 취소
              </Button>
            )}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function ScheduleChangeRequests() {
  const { user } = useAuth();
  const isAdmin = user?.role === "branch_admin";
  const [filters, setFilters] = useState<RequestFilters>(INITIAL_FILTERS);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(
    null
  );
  const [reviewComment, setReviewComment] = useState("");
  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction>(null);
  const utils = trpc.useUtils();

  const filterInput = useMemo(
    () => ({
      requestType:
        filters.requestType === "all"
          ? undefined
          : (filters.requestType as ScheduleChangeRequestType),
      status:
        filters.status === "all"
          ? undefined
          : (filters.status as ScheduleChangeRequestStatus),
      requesterId:
        filters.requesterId === "all"
          ? undefined
          : Number(filters.requesterId),
      targetUserId:
        filters.targetUserId === "all"
          ? undefined
          : Number(filters.targetUserId),
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }),
    [filters]
  );

  const adminListQuery = trpc.scheduleChangeRequests.listAdmin.useQuery(
    filterInput,
    { enabled: isAdmin }
  );
  const myListQuery = trpc.scheduleChangeRequests.listMy.useQuery(filterInput, {
    enabled: !isAdmin,
  });
  const summaryQuery = trpc.scheduleChangeRequests.summary.useQuery(undefined, {
    enabled: isAdmin,
  });
  const adminUsersQuery = trpc.users.list.useQuery(undefined, {
    enabled: isAdmin,
  });

  const requests = isAdmin
    ? (adminListQuery.data ?? [])
    : (myListQuery.data ?? []);
  const isLoading = isAdmin ? adminListQuery.isLoading : myListQuery.isLoading;
  const isError = isAdmin ? adminListQuery.isError : myListQuery.isError;

  const refresh = async () => {
    await Promise.all([
      isAdmin
        ? utils.scheduleChangeRequests.listAdmin.invalidate()
        : utils.scheduleChangeRequests.listMy.invalidate(),
      utils.scheduleChangeRequests.getDetail.invalidate(),
      isAdmin
        ? utils.scheduleChangeRequests.summary.invalidate()
        : Promise.resolve(),
      utils.notifications.list.invalidate(),
    ]);
  };

  const closeDetail = () => {
    setSelectedRequestId(null);
    setReviewComment("");
    setConfirmationAction(null);
  };

  const approveMutation = trpc.scheduleChangeRequests.approve.useMutation({
    onSuccess: async result => {
      await refresh();
      if (result.status === "approved") {
        toast.success("일정 요청을 승인하고 반영했습니다.");
      } else {
        toast.warning(
          `요청 상태가 ${SCHEDULE_CHANGE_REQUEST_STATUS_LABELS[result.status]}(으)로 변경되었습니다.`
        );
      }
      closeDetail();
    },
    onError: error =>
      toastUserFacingError(error, "일정 요청을 승인하지 못했습니다."),
    onSettled: () => setConfirmationAction(null),
  });

  const rejectMutation = trpc.scheduleChangeRequests.reject.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("일정 요청을 반려했습니다.");
      closeDetail();
    },
    onError: error =>
      toastUserFacingError(error, "일정 요청을 반려하지 못했습니다."),
  });

  const cancelMutation = trpc.scheduleChangeRequests.cancelMy.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("일정 요청을 취소했습니다.");
      closeDetail();
    },
    onError: error =>
      toastUserFacingError(error, "일정 요청을 취소하지 못했습니다."),
    onSettled: () => setConfirmationAction(null),
  });

  const mutationPending =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    cancelMutation.isPending;

  const retryList = () => {
    if (isAdmin) void adminListQuery.refetch();
    else void myListQuery.refetch();
  };

  const resetFilters = () => setFilters(INITIAL_FILTERS);
  const hasFilters = Object.values(filters).some(
    value => value !== "" && value !== "all"
  );

  return (
    <DashboardLayout>
      <main className="mx-auto w-full max-w-[1440px] space-y-5 overflow-x-hidden px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-8 lg:px-8">
        <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              {isAdmin ? "승인 업무" : "내 요청"}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-normal sm:text-3xl">
              일정 변경 요청
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {isAdmin
                ? "조직에서 접수된 일정 생성·변경·삭제 요청을 검토하고 실제 일정 반영 여부를 결정합니다."
                : "내가 제출한 일정 생성·변경·삭제 요청의 처리 상태를 확인하고 대기 중인 요청을 취소할 수 있습니다."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              retryList();
              if (isAdmin) void summaryQuery.refetch();
            }}
            disabled={isLoading || summaryQuery.isFetching}
          >
            <RefreshCw
              className={cn(
                (isLoading || summaryQuery.isFetching) && "animate-spin"
              )}
            />
            새로고침
          </Button>
        </header>

        {isAdmin ? (
          <section
            aria-label="일정 요청 요약"
            className="grid grid-cols-2 gap-3 lg:grid-cols-5"
          >
            <SummaryCard
              label="승인 대기"
              value={summaryQuery.data?.pending ?? 0}
              icon={Clock3}
              tone="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            />
            <SummaryCard
              label="오늘 접수"
              value={summaryQuery.data?.today ?? 0}
              icon={CalendarClock}
              tone="bg-primary/10 text-primary"
            />
            <SummaryCard
              label="충돌 확인"
              value={summaryQuery.data?.conflict ?? 0}
              icon={AlertTriangle}
              tone="bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200"
            />
            <SummaryCard
              label="이번 달 승인"
              value={summaryQuery.data?.monthApproved ?? 0}
              icon={CheckCircle2}
              tone="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
            />
            <SummaryCard
              label="이번 달 반려"
              value={summaryQuery.data?.monthRejected ?? 0}
              icon={History}
              tone="bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
            />
          </section>
        ) : null}

        <section
          aria-labelledby="request-filter-title"
          className="space-y-3 border-y border-border/80 py-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="request-filter-title" className="text-base font-semibold">
                요청 목록
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                최대 200건까지 최신순으로 표시합니다.
              </p>
            </div>
            {hasFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
              >
                <FilterX />
                초기화
              </Button>
            ) : null}
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="grid min-w-0 gap-1.5 text-xs font-medium">
              요청 유형
              <Select
                value={filters.requestType}
                onValueChange={value =>
                  setFilters(current => ({ ...current, requestType: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 유형</SelectItem>
                  {SCHEDULE_CHANGE_REQUEST_TYPES.map(type => (
                    <SelectItem key={type} value={type}>
                      {SCHEDULE_CHANGE_REQUEST_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {isAdmin ? (
              <label className="grid min-w-0 gap-1.5 text-xs font-medium">
                요청자
                <Select
                  value={filters.requesterId}
                  onValueChange={value =>
                    setFilters(current => ({ ...current, requesterId: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 요청자</SelectItem>
                    {(adminUsersQuery.data ?? []).map(item => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name ?? "이름 미등록"} · {getRoleLabel(item.role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}

            {isAdmin ? (
              <label className="grid min-w-0 gap-1.5 text-xs font-medium">
                대상 담당자
                <Select
                  value={filters.targetUserId}
                  onValueChange={value =>
                    setFilters(current => ({
                      ...current,
                      targetUserId: value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 대상</SelectItem>
                    {(adminUsersQuery.data ?? []).map(item => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name ?? "이름 미등록"} · {getRoleLabel(item.role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}

            <label className="grid min-w-0 gap-1.5 text-xs font-medium">
              처리 상태
              <Select
                value={filters.status}
                onValueChange={value =>
                  setFilters(current => ({ ...current, status: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  {SCHEDULE_CHANGE_REQUEST_STATUSES.map(status => (
                    <SelectItem key={status} value={status}>
                      {SCHEDULE_CHANGE_REQUEST_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="grid min-w-0 gap-1.5 text-xs font-medium">
              시작일
              <input
                type="date"
                value={filters.dateFrom}
                onChange={event =>
                  setFilters(current => ({
                    ...current,
                    dateFrom: event.target.value,
                  }))
                }
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-9"
              />
            </label>

            <label className="grid min-w-0 gap-1.5 text-xs font-medium">
              종료일
              <input
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={event =>
                  setFilters(current => ({
                    ...current,
                    dateTo: event.target.value,
                  }))
                }
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-9"
              />
            </label>
          </div>
        </section>

        {isLoading ? (
          <LoadingState title="일정 요청 목록을 불러오는 중입니다." />
        ) : isError ? (
          <ErrorState
            title="일정 요청 목록을 불러오지 못했습니다."
            description="잠시 후 다시 시도해 주세요."
            onRetry={retryList}
          />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title={
              hasFilters
                ? "조건에 맞는 요청이 없습니다."
                : "등록된 일정 요청이 없습니다."
            }
            description={
              hasFilters
                ? "필터를 초기화하거나 다른 조건으로 확인해 주세요."
                : isAdmin
                  ? "새 요청이 접수되면 이 화면에서 검토할 수 있습니다."
                  : "일정 화면에서 산하 직원 일정의 변경을 요청할 수 있습니다."
            }
            actionLabel={hasFilters ? "필터 초기화" : undefined}
            onAction={hasFilters ? resetFilters : undefined}
          />
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {requests.map(request => (
                <MobileRequestItem
                  key={request.id}
                  request={request}
                  isAdmin={isAdmin}
                  onOpen={() => setSelectedRequestId(request.id)}
                />
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>요청</TableHead>
                    {isAdmin ? <TableHead>요청자</TableHead> : null}
                    <TableHead>대상 담당자</TableHead>
                    <TableHead>요청 사유</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>접수 시각</TableHead>
                    <TableHead className="w-28 text-right">상세</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map(request => (
                    <TableRow key={request.id}>
                      <TableCell className="max-w-72">
                        <p className="truncate font-medium">
                          {getRequestTitle(request)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {
                            SCHEDULE_CHANGE_REQUEST_TYPE_LABELS[
                              request.requestType
                            ]
                          }
                        </p>
                      </TableCell>
                      {isAdmin ? (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserRound className="h-4 w-4 text-muted-foreground" />
                            <span className="max-w-36 truncate">
                              {request.requester?.name ?? "이름 미등록"}
                            </span>
                          </div>
                        </TableCell>
                      ) : null}
                      <TableCell className="max-w-48 truncate">
                        {requestTargetLabel(request)}
                      </TableCell>
                      <TableCell className="max-w-64">
                        <p className="line-clamp-2 break-words text-sm leading-5">
                          {request.reason}
                        </p>
                      </TableCell>
                      <TableCell>
                        <RequestStatusBadge status={request.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {formatDateTime(request.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedRequestId(request.id)}
                        >
                          상세
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </main>

      <RequestDetailDialog
        requestId={confirmationAction === null ? selectedRequestId : null}
        isAdmin={isAdmin}
        onClose={closeDetail}
        reviewComment={reviewComment}
        onReviewCommentChange={setReviewComment}
        onApprove={() => setConfirmationAction("approve")}
        onReject={() => {
          if (!selectedRequestId || !reviewComment.trim()) return;
          rejectMutation.mutate({
            id: selectedRequestId,
            reviewComment: reviewComment.trim(),
          });
        }}
        onCancel={() => setConfirmationAction("cancel")}
        mutationPending={mutationPending}
      />

      <Dialog
        open={confirmationAction !== null}
        onOpenChange={open => !open && setConfirmationAction(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmationAction === "approve"
                ? "요청을 승인할까요?"
                : "요청을 취소할까요?"}
            </DialogTitle>
            <DialogDescription>
              {confirmationAction === "approve"
                ? "승인하면 서버가 최신 권한과 일정 상태를 다시 확인한 뒤 실제 일정에 반영합니다."
                : "취소한 요청은 다시 승인할 수 없습니다. 필요한 경우 새 요청을 등록해 주세요."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmationAction(null)}
              disabled={mutationPending}
            >
              돌아가기
            </Button>
            <Button
              type="button"
              variant={
                confirmationAction === "cancel" ? "destructive" : "default"
              }
              onClick={() => {
                if (!selectedRequestId) return;
                if (confirmationAction === "approve") {
                  approveMutation.mutate({ id: selectedRequestId });
                } else if (confirmationAction === "cancel") {
                  cancelMutation.mutate({ id: selectedRequestId });
                }
              }}
              disabled={mutationPending}
            >
              {mutationPending ? <Loader2 className="animate-spin" /> : null}
              {confirmationAction === "approve" ? "승인 및 반영" : "요청 취소"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
