import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { PriorityBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatUserWithRole } from "@/lib/userRole";
import {
  OTHER_PIPELINE_COLUMN,
  SALES_PIPELINE_COLUMNS,
  consultStatusToPipelineColumn,
  pipelineColumnToConsultStatus,
  type ConsultStatus,
  type SalesPipelineColumnId,
} from "@shared/salesPipeline";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, LayoutGrid } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  toastUserFacingError,
  USER_FACING_ERRORS,
} from "@/lib/userFacingMessages";
import { toast } from "sonner";

type PipelineScope = "all" | "mine" | "member";

type ListCustomer = {
  id: number;
  name: string;
  consultStatus: string | null;
  priority: string | null;
  agentId: number | null;
  customerTags?: string | null;
};

function parseCustomerTags(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string")
      : [];
  } catch {
    return value
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
  }
}

function groupCustomersByPipeline(customers: ListCustomer[] | undefined) {
  const map: Record<SalesPipelineColumnId, ListCustomer[]> = {
    new: [],
    ta: [],
    ap: [],
    proposal: [],
    subscribed: [],
    other: [],
  };
  if (!customers) return map;
  for (const c of customers) {
    const col = consultStatusToPipelineColumn(c.consultStatus);
    map[col].push(c);
  }
  return map;
}

function parseCustomerIdFromDraggable(id: string | number): number | null {
  const s = String(id);
  if (!s.startsWith("cust:")) return null;
  const n = Number(s.slice(5));
  return Number.isFinite(n) ? n : null;
}

function resolveDropColumnId(
  overId: string | number | null | undefined,
  grouped: Record<SalesPipelineColumnId, ListCustomer[]>
): SalesPipelineColumnId | null {
  if (overId == null) return null;
  const s = String(overId);
  if (s.startsWith("col:")) return s.slice(4) as SalesPipelineColumnId;
  if (s.startsWith("cust:")) {
    const id = Number(s.slice(5));
    for (const col of [
      ...SALES_PIPELINE_COLUMNS.map(c => c.id),
      "other",
    ] as SalesPipelineColumnId[]) {
      if (grouped[col].some(c => c.id === id)) return col;
    }
  }
  return null;
}

function PipelineCard({
  customer,
  agentName,
}: {
  customer: ListCustomer;
  agentName: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `cust:${customer.id}`,
      data: { customerId: customer.id },
    });
  const [, setLocation] = useLocation();
  const tags = parseCustomerTags(
    (customer as { customerTags?: string | null }).customerTags
  ).slice(0, 3);

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-border/80 bg-card/95 shadow-sm transition-shadow",
        isDragging && "opacity-40 ring-2 ring-primary/30"
      )}
    >
      <div className="flex gap-2 p-3">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none rounded-md border border-transparent p-1 text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
          aria-label="드래그하여 단계 이동"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {customer.name}
            </p>
            <PriorityBadge
              priority={customer.priority}
              className="shrink-0 text-[10px]"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {tags.length === 0 ? (
              <span className="text-[10px] text-muted-foreground">
                태그 없음
              </span>
            ) : (
              tags.map(t => (
                <span
                  key={t}
                  className="rounded-full border border-border/80 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {t}
                </span>
              ))
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
            <span className="truncate text-[11px] text-muted-foreground">
              담당: {agentName}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={() => setLocation(`/customers/${customer.id}`)}
            >
              상세
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function PipelineColumn({
  columnId,
  title,
  subtitle,
  children,
}: {
  columnId: SalesPipelineColumnId;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${columnId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[min(100vw-2rem,17.5rem)] shrink-0 flex-col rounded-2xl border border-border/80 bg-gradient-to-b from-card/95 to-muted/20 p-3 shadow-[0_12px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
        isOver && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
      )}
    >
      <div className="mb-3 space-y-0.5 border-b border-border/60 pb-3">
        <h2 className="text-sm font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-[11px] font-medium text-muted-foreground">
          {subtitle}
        </p>
      </div>
      <div className="flex min-h-[12rem] flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

export default function SalesPipeline() {
  const { user } = useAuth();
  const isMember = user?.role === "member";
  const canSwitchScope = Boolean(
    user &&
      ["branch_admin", "sub_branch_admin", "team_leader"].includes(user.role)
  );
  const [pipelineScope, setPipelineScope] = useState<PipelineScope>("all");
  const [selectedMemberId, setSelectedMemberId] = useState("all");
  const effectivePipelineScope = isMember ? "mine" : pipelineScope;
  const managedLabel =
    user?.role === "branch_admin"
      ? "전체 DB"
      : user?.role === "team_leader"
        ? "팀 전체"
        : "산하 전체";
  const { data: usersList } = trpc.users.list.useQuery();
  const { data: filterOptions, isLoading: filterLoading } =
    trpc.salesReports.filterOptions.useQuery(undefined, {
      enabled: canSwitchScope,
    });
  const selectedMember = (filterOptions?.users ?? []).find(
    item => String(item.id) === selectedMemberId
  );
  const needsMemberSelection =
    canSwitchScope &&
    effectivePipelineScope === "member" &&
    selectedMemberId === "all";
  const customerListInput = useMemo(
    () => ({
      scope: effectivePipelineScope,
      selectedUserId:
        effectivePipelineScope === "member" && selectedMemberId !== "all"
          ? Number(selectedMemberId)
          : undefined,
    }),
    [effectivePipelineScope, selectedMemberId]
  );
  const { data: customers, isLoading } = trpc.customers.list.useQuery(
    customerListInput,
    {
      enabled: !needsMemberSelection,
    }
  );
  const utils = trpc.useUtils();

  const agentNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const u of usersList ?? []) {
      m.set(u.id, u.name ?? `사용자 ${u.id}`);
    }
    return m;
  }, [usersList]);

  const grouped = useMemo(
    () => groupCustomersByPipeline(customers),
    [customers]
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeCustomer = useMemo(() => {
    if (!activeId || !customers) return null;
    const id = parseCustomerIdFromDraggable(activeId);
    if (id == null) return null;
    return customers.find(c => c.id === id) ?? null;
  }, [activeId, customers]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: async () => {
      toast.success("파이프라인 단계가 저장되었습니다.");
      await utils.customers.list.invalidate();
    },
    onError: e => {
      toast.error(
        e.message || "저장에 실패했습니다. 권한 또는 네트워크를 확인해 주세요."
      );
    },
  });

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const customerId = parseCustomerIdFromDraggable(active.id);
    if (customerId == null) return;
    const targetCol = resolveDropColumnId(over.id, grouped);
    if (!targetCol) return;
    const cust = customers?.find(c => c.id === customerId);
    if (!cust) return;
    const nextStatus = pipelineColumnToConsultStatus(
      targetCol
    ) as ConsultStatus;
    if (cust.consultStatus === nextStatus) return;
    updateMutation.mutate({ id: customerId, consultStatus: nextStatus });
  };

  const onDragCancel = () => setActiveId(null);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1920px] space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                <LayoutGrid className="h-4 w-4" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                세일즈 파이프라인
              </h1>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              드래그해서 단계를 변경하면 서버에서 권한 검증 후 상담 상태가
              저장됩니다. 범위를 전환하면 실제 파이프라인 카드와 단계별 고객
              수가 다시 계산됩니다.
            </p>
          </div>
          {canSwitchScope ? (
            <div className="w-full max-w-sm space-y-2 rounded-2xl border border-border bg-card p-3 shadow-sm lg:w-80">
              <p className="text-xs font-semibold text-muted-foreground">
                파이프라인 범위
              </p>
              <div className="grid min-h-11 grid-cols-3 rounded-xl border border-border bg-muted/40 p-1">
                {(
                  [
                    ["all", managedLabel],
                    ["mine", "내 담당 고객"],
                    ["member", "조직원별"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={cn(
                      "rounded-lg px-2 py-2 text-sm font-semibold transition",
                      effectivePipelineScope === value
                        ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                        : "text-muted-foreground hover:bg-background"
                    )}
                    onClick={() => {
                      setPipelineScope(value);
                      if (value !== "member") setSelectedMemberId("all");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {effectivePipelineScope === "member" ? (
                <Select
                  value={selectedMemberId}
                  onValueChange={setSelectedMemberId}
                  disabled={filterLoading}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                    <SelectValue placeholder="확인할 조직원을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      확인할 조직원을 선택하세요
                    </SelectItem>
                    {(filterOptions?.users ?? []).map(item => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {formatUserWithRole(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <p className="text-xs leading-relaxed text-muted-foreground">
                {effectivePipelineScope === "member"
                  ? selectedMember
                    ? `${selectedMember.name ?? `사용자 #${selectedMember.id}`}의 담당 고객 기준으로 집계합니다.`
                    : "확인할 조직원을 선택하세요."
                  : effectivePipelineScope === "mine"
                    ? "내가 담당자인 고객만 파이프라인에 표시합니다."
                    : "권한 범위 내 고객을 파이프라인에 표시합니다."}
              </p>
            </div>
          ) : (
            <div className="w-full max-w-xs rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 lg:w-64">
              내 담당 고객 고정
            </div>
          )}
        </div>

        {needsMemberSelection ? (
          <Card className="border-dashed border-border bg-muted/20 p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-foreground">
              확인할 조직원을 선택하세요.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              조직원별 보기는 선택한 조직원이 담당자인 고객만 기준으로 세일즈
              파이프라인을 표시합니다.
            </p>
          </Card>
        ) : isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl bg-muted/50"
              />
            ))}
          </div>
        ) : customers?.length === 0 ? (
          <Card className="border-dashed border-border bg-muted/20 p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-foreground">
              {effectivePipelineScope === "member"
                ? "선택한 조직원의 파이프라인 데이터가 없습니다."
                : effectivePipelineScope === "mine"
                  ? "내 담당 고객 파이프라인 데이터가 없습니다."
                  : "표시할 고객 파이프라인 데이터가 없습니다."}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {effectivePipelineScope === "member"
                ? "선택한 조직원에게 고객을 배정하면 이곳에 표시됩니다."
                : effectivePipelineScope === "mine"
                  ? "고객을 직접 등록하거나 담당자로 배정받으면 이곳에 표시됩니다."
                  : "고객 등록 또는 필터 범위를 확인해 주세요."}
            </p>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <div className="w-full overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2">
              <div className="flex w-max gap-3 pb-2 pr-1">
                {SALES_PIPELINE_COLUMNS.map(col => (
                  <PipelineColumn
                    key={col.id}
                    columnId={col.id}
                    title={col.title}
                    subtitle={col.subtitle}
                  >
                    {grouped[col.id].map(c => (
                      <PipelineCard
                        key={c.id}
                        customer={c}
                        agentName={
                          c.agentId != null
                            ? (agentNameById.get(c.agentId) ?? "담당자")
                            : "미배정"
                        }
                      />
                    ))}
                  </PipelineColumn>
                ))}
                <PipelineColumn
                  columnId="other"
                  title={OTHER_PIPELINE_COLUMN.title}
                  subtitle={OTHER_PIPELINE_COLUMN.subtitle}
                >
                  {grouped.other.map(c => (
                    <PipelineCard
                      key={c.id}
                      customer={c}
                      agentName={
                        c.agentId != null
                          ? (agentNameById.get(c.agentId) ?? "담당자")
                          : "미배정"
                      }
                    />
                  ))}
                </PipelineColumn>
              </div>
            </div>

            <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
              {activeCustomer ? (
                <Card className="w-[min(100vw-2rem,17.5rem)] cursor-grabbing border-primary/30 bg-card shadow-xl">
                  <div className="flex gap-2 p-3">
                    <GripVertical className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-semibold">
                        {activeCustomer.name}
                      </p>
                      <PriorityBadge
                        priority={activeCustomer.priority}
                        className="text-[10px]"
                      />
                    </div>
                  </div>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </DashboardLayout>
  );
}
