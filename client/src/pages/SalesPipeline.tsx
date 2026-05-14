import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
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
import { toast } from "sonner";

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
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return value.split(",").map((t) => t.trim()).filter(Boolean);
  }
}

function priorityLabel(priority?: string | null) {
  switch (priority) {
    case "A":
      return "A";
    case "B":
      return "B";
    case "C":
      return "C";
    case "D":
      return "D";
    case "unclassified":
    default:
      return "미분류";
  }
}

function priorityBadgeClass(priority?: string | null) {
  switch (priority) {
    case "A":
      return "border-0 bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200";
    case "B":
      return "border-0 bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100";
    case "C":
      return "border-0 bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100";
    case "D":
      return "border-0 bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
    default:
      return "border-border bg-muted text-muted-foreground";
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
    for (const col of [...SALES_PIPELINE_COLUMNS.map((c) => c.id), "other"] as SalesPipelineColumnId[]) {
      if (grouped[col].some((c) => c.id === id)) return col;
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `cust:${customer.id}`,
    data: { customerId: customer.id },
  });
  const [, setLocation] = useLocation();
  const tags = parseCustomerTags((customer as { customerTags?: string | null }).customerTags).slice(0, 3);

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 50 : undefined }
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
            <p className="truncate text-sm font-semibold text-foreground">{customer.name}</p>
            <Badge className={cn("shrink-0 text-[10px] font-semibold", priorityBadgeClass(customer.priority))}>
              {priorityLabel(customer.priority)}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {tags.length === 0 ? (
              <span className="text-[10px] text-muted-foreground">태그 없음</span>
            ) : (
              tags.map((t) => (
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
            <span className="truncate text-[11px] text-muted-foreground">담당: {agentName}</span>
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
        <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>
        <p className="text-[11px] font-medium text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex min-h-[12rem] flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

export default function SalesPipeline() {
  const { data: customers, isLoading } = trpc.customers.list.useQuery({});
  const { data: usersList } = trpc.users.list.useQuery();
  const utils = trpc.useUtils();

  const agentNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const u of usersList ?? []) {
      m.set(u.id, u.name ?? `사용자 ${u.id}`);
    }
    return m;
  }, [usersList]);

  const grouped = useMemo(() => groupCustomersByPipeline(customers), [customers]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeCustomer = useMemo(() => {
    if (!activeId || !customers) return null;
    const id = parseCustomerIdFromDraggable(activeId);
    if (id == null) return null;
    return customers.find((c) => c.id === id) ?? null;
  }, [activeId, customers]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: async () => {
      toast.success("파이프라인 단계가 저장되었습니다.");
      await utils.customers.list.invalidate();
    },
    onError: (e) => {
      toast.error(e.message || "저장에 실패했습니다. 권한 또는 네트워크를 확인해 주세요.");
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
    const cust = customers?.find((c) => c.id === customerId);
    if (!cust) return;
    const nextStatus = pipelineColumnToConsultStatus(targetCol) as ConsultStatus;
    if (cust.consultStatus === nextStatus) return;
    updateMutation.mutate({ id: customerId, consultStatus: nextStatus });
  };

  const onDragCancel = () => setActiveId(null);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1920px] space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              <LayoutGrid className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">세일즈 파이프라인</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            드래그하여 단계를 변경하면 서버에서 권한 검증 후 상담 상태가 저장됩니다. 지점장은 전체, 부지점장·팀장은 산하, 팀원은 본인 담당 고객만 표시됩니다.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted/50" />
            ))}
          </div>
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
                {SALES_PIPELINE_COLUMNS.map((col) => (
                  <PipelineColumn key={col.id} columnId={col.id} title={col.title} subtitle={col.subtitle}>
                    {grouped[col.id].map((c) => (
                      <PipelineCard
                        key={c.id}
                        customer={c}
                        agentName={c.agentId != null ? agentNameById.get(c.agentId) ?? "담당자" : "미배정"}
                      />
                    ))}
                  </PipelineColumn>
                ))}
                <PipelineColumn
                  columnId="other"
                  title={OTHER_PIPELINE_COLUMN.title}
                  subtitle={OTHER_PIPELINE_COLUMN.subtitle}
                >
                  {grouped.other.map((c) => (
                    <PipelineCard
                      key={c.id}
                      customer={c}
                      agentName={c.agentId != null ? agentNameById.get(c.agentId) ?? "담당자" : "미배정"}
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
                      <p className="truncate text-sm font-semibold">{activeCustomer.name}</p>
                      <Badge className={cn("text-[10px]", priorityBadgeClass(activeCustomer.priority))}>
                        {priorityLabel(activeCustomer.priority)}
                      </Badge>
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
