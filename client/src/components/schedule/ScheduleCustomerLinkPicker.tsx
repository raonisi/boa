import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ERROR_UX } from "@/lib/stateUxCopy";
import { cn } from "@/lib/utils";
import { Loader2, Search, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ScheduleCustomerLinkPickerProps = {
  value: number | null;
  onChange: (customerId: number | null) => void;
  disabled?: boolean;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function ScheduleCustomerLinkPicker({
  value,
  onChange,
  disabled = false,
}: ScheduleCustomerLinkPickerProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const trimmedSearch = debouncedSearch.trim();
  const canSearch = trimmedSearch.length >= 2;

  const pickerQuery = trpc.customers.searchForSchedulePicker.useQuery(
    {
      search: canSearch ? trimmedSearch : undefined,
      selectedCustomerId: value ?? undefined,
      limit: 20,
    },
    {
      enabled: !disabled && (canSearch || value != null),
      staleTime: 30_000,
    }
  );

  const selectedCustomer = useMemo(() => {
    if (!value) return null;
    const fromSelected = pickerQuery.data?.selectedCustomer;
    if (fromSelected?.id === value) return fromSelected;
    return pickerQuery.data?.items.find(item => item.id === value) ?? fromSelected;
  }, [pickerQuery.data, value]);

  const resultItems = useMemo(() => {
    const items = pickerQuery.data?.items ?? [];
    if (!value) return items;
    return items.filter(item => item.id !== value);
  }, [pickerQuery.data?.items, value]);

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">고객 연결</Label>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          일정과 연결할 고객을 검색해 선택하세요.
        </p>
      </div>

      {selectedCustomer ? (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">{selectedCustomer.name}</p>
              <Badge variant="secondary" className="text-[10px]">
                {selectedCustomer.statusLabel}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {selectedCustomer.priorityLabel}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedCustomer.maskedPhone ?? "연락처 없음"}
              {selectedCustomer.assignedUserName
                ? ` · 담당 ${selectedCustomer.assignedUserName}`
                : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={disabled}
            onClick={() => {
              onChange(null);
              setSearch("");
            }}
            aria-label="연결 해제"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="고객명 또는 연락처로 검색"
          className="h-11 pl-9 md:h-9"
          disabled={disabled}
          autoComplete="off"
        />
      </div>

      {!canSearch && !pickerQuery.isFetching ? (
        <p className="text-[11px] text-muted-foreground">
          {pickerQuery.data?.hint ??
            "고객명 또는 연락처 2글자 이상으로 검색해 주세요."}
        </p>
      ) : null}

      {pickerQuery.isFetching ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          검색 중입니다.
        </div>
      ) : null}

      {pickerQuery.isError ? (
        <p className="text-xs text-destructive" role="alert">
          {ERROR_UX.scopedLoadTitle("고객")} {ERROR_UX.loadDescription}
        </p>
      ) : null}

      {canSearch && !pickerQuery.isFetching && pickerQuery.data ? (
        <div className="max-h-52 space-y-1 overflow-y-auto overscroll-contain rounded-md border bg-background p-1">
          {resultItems.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {pickerQuery.data.hint ?? "검색 결과가 없습니다."}
            </p>
          ) : (
            resultItems.map(item => (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                className={cn(
                  "w-full rounded-md px-3 py-2.5 text-left transition-colors",
                  "hover:bg-muted/70 active:bg-muted",
                  "min-h-11 md:min-h-9"
                )}
                onClick={() => {
                  onChange(item.id);
                  setSearch("");
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{item.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {item.statusLabel}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.maskedPhone ?? "연락처 없음"}
                  {item.assignedUserName ? ` · 담당 ${item.assignedUserName}` : ""}
                </p>
              </button>
            ))
          )}
          {pickerQuery.data.tooManyResults ? (
            <p className="px-2 py-1 text-[11px] text-muted-foreground">
              검색 결과가 많습니다. 검색어를 더 입력해 주세요.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
