import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  CUSTOMER_RELATIONSHIP_SENSITIVE_NOTE_ERROR,
  CUSTOMER_RELATIONSHIP_TYPE_CONFIG,
  CUSTOMER_RELATIONSHIP_TYPES,
  resolveDefaultDirection,
  resolveRelationshipLabel,
  type CustomerRelationshipType,
} from "@shared/customerRelationships";
import { formatKstLocalDateTime } from "@shared/timePolicy";
import { Edit2, Link2, Plus, Trash2, UserRound } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  toastUserFacingError,
  USER_FACING_ERRORS,
} from "@/lib/userFacingMessages";
import { toast } from "sonner";
import { useLocation } from "wouter";

const RELATIONSHIP_TYPE_OPTIONS = CUSTOMER_RELATIONSHIP_TYPES.map(type => ({
  value: type,
  label:
    CUSTOMER_RELATIONSHIP_TYPE_CONFIG[type].labels.mutual ??
    CUSTOMER_RELATIONSHIP_TYPE_CONFIG[type].labels.outbound ??
    "기타",
}));

type RelationshipItem = {
  id: number;
  relationshipType: CustomerRelationshipType;
  relationshipLabel: string;
  note: string | null;
  status: "active" | "inactive";
  relatedCustomer: {
    id: number;
    name: string;
    consultStatus: string;
    agentName: string | null;
    lastConsultedAt: string | null;
    nextContactDate: string | null;
  };
};

type CustomerRelationshipsPanelProps = {
  customerId: number;
  canManage: boolean;
};

export function CustomerRelationshipsPanel({
  customerId,
  canManage,
}: CustomerRelationshipsPanelProps) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: relationships, isLoading } =
    trpc.customerRelationships.list.useQuery({ customerId });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRelationship, setEditingRelationship] =
    useState<RelationshipItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RelationshipItem | null>(
    null
  );

  const [search, setSearch] = useState("");
  const [selectedRelatedCustomerId, setSelectedRelatedCustomerId] = useState<
    number | null
  >(null);
  const [relationshipType, setRelationshipType] =
    useState<CustomerRelationshipType>("family_spouse");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const trimmedSearch = search.trim();
  const { data: searchResult, isFetching: isSearching } =
    trpc.customerRelationships.searchCustomers.useQuery(
      {
        customerId,
        search: trimmedSearch,
        limit: 20,
      },
      { enabled: showCreateModal && trimmedSearch.length >= 2 }
    );

  const createMutation = trpc.customerRelationships.create.useMutation({
    onSuccess: async () => {
      toast.success("고객 관계가 추가되었습니다.");
      setShowCreateModal(false);
      resetForm();
      await Promise.all([
        utils.customerRelationships.list.invalidate({ customerId }),
        utils.customers.timeline.invalidate({ customerId }),
      ]);
    },
    onError: error =>
      toastUserFacingError(error, USER_FACING_ERRORS.saveFailed, "customer"),
  });

  const updateMutation = trpc.customerRelationships.update.useMutation({
    onSuccess: async () => {
      toast.success("고객 관계가 수정되었습니다.");
      setEditingRelationship(null);
      resetForm();
      await Promise.all([
        utils.customerRelationships.list.invalidate({ customerId }),
        utils.customers.timeline.invalidate({ customerId }),
      ]);
    },
    onError: error =>
      toastUserFacingError(error, USER_FACING_ERRORS.saveFailed, "customer"),
  });

  const deleteMutation = trpc.customerRelationships.delete.useMutation({
    onSuccess: async () => {
      toast.success("고객 관계가 삭제되었습니다.");
      setDeleteTarget(null);
      await Promise.all([
        utils.customerRelationships.list.invalidate({ customerId }),
        utils.customers.timeline.invalidate({ customerId }),
      ]);
    },
    onError: error =>
      toastUserFacingError(error, USER_FACING_ERRORS.saveFailed, "customer"),
  });

  const previewLabel = useMemo(() => {
    const direction = resolveDefaultDirection(relationshipType);
    return resolveRelationshipLabel(relationshipType, direction);
  }, [relationshipType]);

  function resetForm() {
    setSearch("");
    setSelectedRelatedCustomerId(null);
    setRelationshipType("family_spouse");
    setNote("");
    setStatus("active");
  }

  useEffect(() => {
    if (!showCreateModal && !editingRelationship) resetForm();
  }, [showCreateModal, editingRelationship]);

  useEffect(() => {
    if (!editingRelationship) return;
    setRelationshipType(editingRelationship.relationshipType);
    setNote(editingRelationship.note ?? "");
    setStatus(editingRelationship.status);
  }, [editingRelationship]);

  const openCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const submitCreate = () => {
    if (!selectedRelatedCustomerId) {
      toast.error("연결할 고객을 선택해 주세요.");
      return;
    }
    createMutation.mutate({
      customerId,
      relatedCustomerId: selectedRelatedCustomerId,
      relationshipType,
      note: note.trim() || undefined,
    });
  };

  const submitUpdate = () => {
    if (!editingRelationship) return;
    updateMutation.mutate({
      id: editingRelationship.id,
      customerId,
      relationshipType,
      note: note.trim() ? note.trim() : null,
      status,
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ id: deleteTarget.id, customerId });
  };

  const renderRelationshipCard = (item: RelationshipItem) => (
    <Card key={item.id} className="border-border/80 shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                {item.relationshipLabel}
              </span>
              <StatusBadge status={item.relatedCustomer.consultStatus} />
              {item.status === "inactive" ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  비활성
                </span>
              ) : null}
            </div>
            <div>
              <p className="truncate text-base font-semibold text-foreground">
                {item.relatedCustomer.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                담당 {item.relatedCustomer.agentName ?? "미배정"}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {item.relatedCustomer.lastConsultedAt ? (
                <span>
                  최근 상담{" "}
                  {formatKstLocalDateTime(item.relatedCustomer.lastConsultedAt)}
                </span>
              ) : null}
              {item.relatedCustomer.nextContactDate ? (
                <span>
                  다음 연락{" "}
                  {formatKstLocalDateTime(item.relatedCustomer.nextContactDate)}
                </span>
              ) : null}
            </div>
            {item.note ? (
              <p className="line-clamp-2 text-sm text-slate-700">{item.note}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-10"
              onClick={() =>
                setLocation(`/customers/${item.relatedCustomer.id}`)
              }
            >
              <UserRound className="mr-1 h-4 w-4" />
              상세
            </Button>
            {canManage ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  onClick={() => setEditingRelationship(item)}
                >
                  <Edit2 className="mr-1 h-4 w-4" />
                  수정
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10 text-rose-700 hover:text-rose-800"
                  onClick={() => setDeleteTarget(item)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  삭제
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Link2 className="h-4 w-4 text-indigo-600" />
            연결 고객
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            가족, 소개, 직장, 법인 관계를 연결해 고객 네트워크를 관리합니다.
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            size="sm"
            className="min-h-10"
            onClick={openCreate}
          >
            <Plus className="mr-1 h-4 w-4" />
            관계 추가
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            연결 고객을 불러오는 중입니다...
          </CardContent>
        </Card>
      ) : relationships && relationships.length > 0 ? (
        <div className="grid gap-3">
          {relationships.map(renderRelationshipCard)}
        </div>
      ) : (
        <EmptyState
          title="연결된 고객이 없습니다"
          description="가족, 소개, 직장, 법인 관계를 추가해 고객 관계도를 시작해 보세요."
          action={
            canManage ? (
              <Button type="button" size="sm" onClick={openCreate}>
                관계 추가
              </Button>
            ) : undefined
          }
        />
      )}

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>고객 관계 추가</DialogTitle>
            <DialogDescription>
              연결할 고객을 검색하고 관계 유형을 선택하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="relationship-search">연결 고객 검색</Label>
              <Input
                id="relationship-search"
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  setSelectedRelatedCustomerId(null);
                }}
                placeholder="고객명 2자 이상 입력"
              />
              {trimmedSearch.length > 0 && trimmedSearch.length < 2 ? (
                <p className="text-xs text-muted-foreground">
                  2자 이상 입력해 주세요.
                </p>
              ) : null}
              {isSearching ? (
                <p className="text-xs text-muted-foreground">검색 중...</p>
              ) : null}
              {searchResult?.items?.length ? (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                  {searchResult.items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted ${
                        selectedRelatedCustomerId === item.id
                          ? "bg-indigo-50 text-indigo-900"
                          : ""
                      }`}
                      onClick={() => setSelectedRelatedCustomerId(item.id)}
                    >
                      <span className="font-medium">{item.name}</span>
                      <StatusBadge status={item.consultStatus} />
                    </button>
                  ))}
                </div>
              ) : trimmedSearch.length >= 2 && !isSearching ? (
                <p className="text-xs text-muted-foreground">
                  {searchResult?.hint ?? "검색 결과가 없습니다."}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>관계 유형</Label>
              <Select
                value={relationshipType}
                onValueChange={value =>
                  setRelationshipType(value as CustomerRelationshipType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_TYPE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                표시 라벨: <span className="font-medium">{previewLabel}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship-note">관계 메모</Label>
              <Textarea
                id="relationship-note"
                value={note}
                onChange={event => setNote(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="짧은 업무 메모만 입력 (선택)"
              />
              <p className="text-xs text-amber-700">
                {CUSTOMER_RELATIONSHIP_SENSITIVE_NOTE_ERROR}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateModal(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={submitCreate}
              disabled={createMutation.isPending}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingRelationship)}
        onOpenChange={open => !open && setEditingRelationship(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>고객 관계 수정</DialogTitle>
            <DialogDescription>
              {editingRelationship?.relatedCustomer.name} 고객과의 관계를
              수정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>관계 유형</Label>
              <Select
                value={relationshipType}
                onValueChange={value =>
                  setRelationshipType(value as CustomerRelationshipType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_TYPE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                표시 라벨: <span className="font-medium">{previewLabel}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>상태</Label>
              <Select
                value={status}
                onValueChange={value =>
                  setStatus(value as "active" | "inactive")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="inactive">비활성</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship-note-edit">관계 메모</Label>
              <Textarea
                id="relationship-note-edit"
                value={note}
                onChange={event => setNote(event.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-amber-700">
                {CUSTOMER_RELATIONSHIP_SENSITIVE_NOTE_ERROR}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingRelationship(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={submitUpdate}
              disabled={updateMutation.isPending}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>고객 관계 삭제</DialogTitle>
            <DialogDescription>
              {deleteTarget?.relatedCustomer.name} 고객과의 관계를 삭제합니다.
              삭제된 관계는 목록에서 제외되며 이력에는 기록만 남습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
