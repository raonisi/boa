import { useAuth } from "@/_core/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import {
  getUnreadBadgeAriaLabel,
  getUnreadBadgeLabel,
} from "@/lib/unreadBadge";
import {
  filterNavGroups,
  mobileMoreNavGroups,
  mobilePrimaryItems,
  mobileQuickLinksForRole,
} from "@/lib/navigationConfig";
import { getRoleLabel } from "@/lib/userRole";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export function MobileNav() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const {
    data: unreadCount,
    isLoading: isUnreadLoading,
    isError: isUnreadError,
  } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const unreadBadgeInput = {
    count: unreadCount,
    isLoading: isUnreadLoading,
    isError: isUnreadError,
  };
  const unreadBadgeLabel = getUnreadBadgeLabel(unreadBadgeInput);
  const unreadBadgeAriaLabel = getUnreadBadgeAriaLabel(unreadBadgeInput);

  const quickLinks = mobileQuickLinksForRole(user?.role);
  const moreGroups = filterNavGroups(mobileMoreNavGroups, user);

  const goTo = (path: string) => {
    setLocation(path);
    setMoreOpen(false);
  };

  const renderMenuButton = (
    item: (typeof mobilePrimaryItems)[number],
    options?: { compact?: boolean }
  ) => {
    const isActive =
      location === item.path ||
      (item.path !== "/" && location.startsWith(item.path));
    const isNotif = item.path === "/notifications";

    if (options?.compact) {
      return (
        <SheetClose asChild key={`${item.label}-${item.path}`}>
          <button
            type="button"
            data-testid="mobile-more-menu-item"
            onClick={() => goTo(item.path)}
            className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
              isActive
                ? "border-sidebar-primary/50 bg-sidebar-primary/10 text-foreground"
                : "border-border bg-muted/30 text-foreground hover:bg-muted/50"
            }`}
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
          </button>
        </SheetClose>
      );
    }

    return (
      <button
        key={item.path}
        type="button"
        onClick={() => goTo(item.path)}
        className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold transition-colors ${
          isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70"
        }`}
      >
        <span
          className={`relative flex h-12 w-12 items-center justify-center rounded-lg ${
            isActive
              ? "bg-sidebar-primary/12 ring-1 ring-sidebar-primary/25"
              : ""
          }`}
        >
          <item.icon className="h-5 w-5" />
          {isNotif && unreadBadgeLabel ? (
            <span
              className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white"
              aria-hidden="true"
            >
              {unreadBadgeLabel}
            </span>
          ) : null}
        </span>
        <span
          className="w-full truncate text-center leading-tight"
          aria-label={isNotif ? unreadBadgeAriaLabel : undefined}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar/98 text-sidebar-foreground shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md md:hidden dark:shadow-[0_-8px_28px_rgba(0,0,0,0.35)]">
        <div className="grid min-h-[68px] grid-cols-5 px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5">
          {mobilePrimaryItems.map(item => renderMenuButton(item))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold transition-colors ${
              moreOpen ? "text-sidebar-primary" : "text-sidebar-foreground/70"
            }`}
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                moreOpen
                  ? "bg-sidebar-primary/12 ring-1 ring-sidebar-primary/25"
                  : ""
              }`}
            >
              <Menu className="h-5 w-5" />
            </span>
            <span className="w-full truncate text-center leading-tight">
              더보기
            </span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
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
          </SheetHeader>
          <div className="mt-4 max-h-[calc(86vh-7rem)] space-y-5 overflow-y-auto overscroll-contain pb-4">
            {quickLinks.length > 0 ? (
              <section>
                <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  오늘 바로가기
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {quickLinks.map(item => renderMenuButton(item, { compact: true }))}
                </div>
              </section>
            ) : null}

            {moreGroups.map(group => (
              <section key={group.label}>
                <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {group.items.map(item => renderMenuButton(item, { compact: true }))}
                </div>
              </section>
            ))}

            <button
              type="button"
              data-testid="mobile-more-menu-item"
              onClick={() => {
                setMoreOpen(false);
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
    </>
  );
}
