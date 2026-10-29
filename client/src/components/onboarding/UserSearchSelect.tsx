import * as React from "react";
import { useState, useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRoleLabel } from "@/lib/userRole";

export interface UserOption {
  id: number;
  name: string | null;
  role: string;
  teamId?: number | null;
  subBranchAdminId?: number | null;
  accountStatus?: string | null;
}

export interface UserSearchSelectProps {
  label?: string;
  value: string;
  onChange: (userId: string) => void;
  users: UserOption[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  optional?: boolean;
  testIdPrefix?: string;
  className?: string;
}

export function UserSearchSelect({
  label,
  value,
  onChange,
  users,
  isLoading = false,
  isError = false,
  onRetry,
  placeholder = "직원 선택",
  searchPlaceholder = "이름으로 직원 검색...",
  emptyMessage = "검색 결과가 없습니다.",
  disabled = false,
  optional = false,
  testIdPrefix = "user-select",
  className,
}: UserSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedUser = useMemo(
    () => users.find(u => String(u.id) === value),
    [users, value]
  );

  const nameCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) {
      if (u.name) {
        counts.set(u.name, (counts.get(u.name) ?? 0) + 1);
      }
    }
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => {
      const nameMatch = u.name ? u.name.toLowerCase().includes(q) : false;
      const idMatch = String(u.id).includes(q);
      const roleLabel = getRoleLabel(u.role).toLowerCase();
      const roleMatch = roleLabel.includes(q) || u.role.toLowerCase().includes(q);
      return nameMatch || idMatch || roleMatch;
    });
  }, [users, searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label ?? placeholder}
          disabled={disabled || isLoading}
          data-testid={`${testIdPrefix}-trigger`}
          className={cn(
            "w-full max-w-full min-w-0 min-h-10 justify-between font-normal text-left px-3 overflow-hidden",
            !selectedUser && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 overflow-hidden pointer-events-none">
            {selectedUser ? (
              <>
                <span className="font-medium text-foreground truncate min-w-0 shrink">
                  {selectedUser.name ?? `사용자 #${selectedUser.id}`}
                </span>
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0 shrink-0"
                >
                  {getRoleLabel(selectedUser.role)}
                </Badge>
                <span className="text-xs text-muted-foreground shrink-0">
                  #{selectedUser.id}
                </span>
              </>
            ) : (
              <span className="truncate min-w-0">
                {isLoading ? "직원 목록 불러오는 중..." : placeholder}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-auto pl-1">
            {selectedUser && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label={`${label ?? "직원"} 선택 해제`}
                data-testid={`${testIdPrefix}-clear-btn`}
                className="p-1 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors z-10"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange("");
                  }
                }}
              >
                <X className="h-3.5 w-3.5 pointer-events-none" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 pointer-events-none" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[calc(100vw-16px)] p-0 z-50"
        align="start"
        collisionPadding={8}
      >
        <Command shouldFilter={false} className="max-h-[320px]">
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
            data-testid={`${testIdPrefix}-search-input`}
          />
          <CommandList data-testid={`${testIdPrefix}-list`}>
            {isLoading ? (
              <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                직원 목록을 불러오는 중...
              </div>
            ) : isError ? (
              <div className="p-4 text-center text-sm text-destructive space-y-2">
                <p>직원 목록을 불러오지 못했습니다.</p>
                {onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    data-testid={`${testIdPrefix}-retry-btn`}
                  >
                    다시 시도
                  </Button>
                )}
              </div>
            ) : (
              <>
                {filteredUsers.length === 0 ? (
                  <div
                    className="py-6 text-center text-sm text-muted-foreground"
                    data-testid={`${testIdPrefix}-empty`}
                  >
                    {emptyMessage}
                  </div>
                ) : (
                  <CommandGroup>
                    {optional && value && (
                      <CommandItem
                        onSelect={() => {
                          onChange("");
                          setOpen(false);
                        }}
                        className="text-muted-foreground italic text-xs py-2 px-3 cursor-pointer"
                        data-testid={`${testIdPrefix}-option-clear`}
                      >
                        선택 안 함 (초기화)
                      </CommandItem>
                    )}
                    {filteredUsers.map(u => {
                      const isSelected = String(u.id) === value;
                      const isDuplicateName =
                        Boolean(u.name && (nameCount.get(u.name) ?? 0) > 1);
                      return (
                        <CommandItem
                          key={u.id}
                          value={String(u.id)}
                          onSelect={() => {
                            onChange(String(u.id));
                            setOpen(false);
                          }}
                          data-testid={`${testIdPrefix}-option-${u.id}`}
                          className="flex items-center justify-between cursor-pointer py-2 px-3 min-h-[40px]"
                        >
                          <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isSelected
                                  ? "opacity-100 text-primary"
                                  : "opacity-0"
                              )}
                            />
                            <span className="font-medium truncate min-w-0">
                              {u.name ?? `사용자 #${u.id}`}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0 shrink-0"
                            >
                              {getRoleLabel(u.role)}
                            </Badge>
                            <span className="text-xs text-muted-foreground shrink-0">
                              #{u.id}
                            </span>
                            {isDuplicateName && (
                              <span className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.5 rounded shrink-0">
                                동명이인
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
export default UserSearchSelect;
