import { BrandLogo } from "@/components/BrandLogo";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  filterNavGroups,
  mobileMoreNavGroups,
  mobilePrimaryItems,
  mobileQuickLinksForRole,
  type NavItem,
} from "@/lib/navigationConfig";
import { resolveActiveNavItem } from "@/lib/navigationMatch";
import { cn } from "@/lib/utils";
import { getRoleLabel } from "@/lib/userRole";
import {
  getInitialExpandedGroups,
  searchNavItems,
} from "@/lib/mobileMoreMenu";
import { LogOut } from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: { role?: string | null } | null;
  logout: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ClearIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function MobileMoreSheet({
  open,
  onOpenChange,
  user,
  logout,
  triggerRef,
}: MobileMoreSheetProps) {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const quickLinks = mobileQuickLinksForRole(user?.role);
  const moreGroups = filterNavGroups(mobileMoreNavGroups, user);
  const mobileNavContext = [
    { label: "오늘 실행", items: mobilePrimaryItems },
    ...moreGroups,
  ];
  const activeNav = resolveActiveNavItem(mobileNavContext, location);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    getInitialExpandedGroups(moreGroups, activeNav?.groupLabel)
  );

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (nextOpen) {
      setExpandedGroups(prev => ({
        ...prev,
        ...getInitialExpandedGroups(moreGroups, activeNav?.groupLabel),
      }));
    } else {
      setSearchQuery("");
    }
  };

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupLabel]: !prev[groupLabel],
    }));
  };

  const goTo = (path: string) => {
    setLocation(path);
    onOpenChange(false);
    setSearchQuery("");
  };

  const searchResults = searchNavItems(moreGroups, quickLinks, searchQuery);
  const isSearching = searchQuery.trim().length > 0;

  const renderItemButton = (
    item: NavItem,
    options?: { badge?: string }
  ) => {
    const isActive = activeNav?.item.path === item.path;

    return (
      <SheetClose asChild key={`${item.label}-${item.path}`}>
        <button
          type="button"
          data-testid="mobile-more-menu-item"
          onClick={() => goTo(item.path)}
          className={cn(
            "flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
            isActive
              ? "border-sidebar-primary/50 bg-sidebar-primary/10 text-foreground"
              : "border-border bg-muted/30 text-foreground hover:bg-muted/50",
            item.emphasis === "risk" &&
              !isActive &&
              "border-amber-500/30 bg-amber-500/[0.04]"
          )}
        >
          <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block whitespace-normal break-words leading-snug">
              {item.label}
            </span>
            {item.description ? (
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {item.description}
              </span>
            ) : null}
          </span>
          {options?.badge ? (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
              {options.badge}
            </span>
          ) : null}
        </button>
      </SheetClose>
    );
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        onOpenAutoFocus={e => {
          e.preventDefault();
          const container = e.currentTarget as HTMLElement | null;
          const target = container?.querySelector<HTMLElement>(
            'button[data-testid="mobile-more-menu-item"], button[data-testid="mobile-more-group-toggle"]'
          );
          target?.focus();
        }}
        onCloseAutoFocus={e => {
          if (triggerRef?.current) {
            e.preventDefault();
            triggerRef.current.focus();
          }
        }}
        className="max-h-[min(86vh,42rem)] rounded-t-2xl border-border bg-card pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:hidden"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="flex flex-col gap-1 text-left text-base font-semibold">
            <span className="flex items-center gap-3">
              <BrandLogo className="h-9 w-24 justify-start" />
              <span>업무 메뉴</span>
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {getRoleLabel(user?.role)} · 권한 범위 안의 메뉴만 표시됩니다
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">
            전체 메뉴 목록 및 탐색
          </SheetDescription>
        </SheetHeader>

        {/* Search bar */}
        <div className="relative mt-2">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="업무 메뉴 검색 (예: 계약, 온보딩, 리스크)"
            aria-label="업무 메뉴 검색"
            autoComplete="off"
            className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-12 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/50"
          />
          {searchQuery.trim().length > 0 ? (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => setSearchQuery("")}
              className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/50"
            >
              <ClearIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-3 max-h-[calc(86vh-9.5rem)] space-y-4 overflow-y-auto overscroll-contain pb-4">
          {isSearching ? (
            <section>
              <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-muted-foreground">
                <span>검색 결과</span>
                <span>{searchResults.length}건</span>
              </div>
              {searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
                  <SearchIcon className="mb-2 h-8 w-8 text-muted-foreground/40" />
                  <span>일치하는 업무 메뉴가 없습니다.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {searchResults.map(item =>
                    renderItemButton(item, {
                      badge: item.groupLabel,
                    })
                  )}
                </div>
              )}
            </section>
          ) : (
            <>
              {quickLinks.length > 0 ? (
                <section>
                  <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    오늘 바로가기
                  </h3>
                  <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                    {quickLinks.map((item, idx) => (
                      <div
                        key={`${item.label}-${item.path}`}
                        className={cn(
                          "col-span-1",
                          quickLinks.length === 5 && idx === 4 && "min-[360px]:col-span-2"
                        )}
                      >
                        {renderItemButton(item)}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {moreGroups.map(group => {
                const isExpanded = expandedGroups[group.label] ?? false;
                return (
                  <section
                    key={group.label}
                    className="border-b border-border/40 pb-3 last:border-b-0"
                  >
                    <button
                      type="button"
                      data-testid="mobile-more-group-toggle"
                      aria-expanded={isExpanded}
                      onClick={() => toggleGroup(group.label)}
                      className="flex min-h-[44px] w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-sm font-semibold tracking-wide transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/50"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            activeNav?.groupLabel === group.label
                              ? "text-primary"
                              : "text-foreground"
                          )}
                        >
                          {group.label}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                          {group.items.length}
                        </span>
                      </span>
                      <ChevronDownIcon
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </button>
                    {isExpanded ? (
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        {group.items.map(item =>
                          renderItemButton(item)
                        )}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </>
          )}

          <button
            type="button"
            data-testid="mobile-more-menu-item"
            onClick={() => {
              onOpenChange(false);
              setSearchQuery("");
              logout();
            }}
            className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-left text-sm font-medium text-destructive"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
              로그아웃
            </span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileMoreSheet;
