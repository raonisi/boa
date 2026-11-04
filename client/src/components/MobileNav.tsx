import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  getUnreadBadgeAriaLabel,
  getUnreadBadgeLabel,
} from "@/lib/unreadBadge";
import {
  mobilePrimaryItems,
  type NavItem,
} from "@/lib/navigationConfig";
import { resolveActiveNavItem } from "@/lib/navigationMatch";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

type MoreSheet = typeof import("./MobileMoreSheet").MobileMoreSheet;

let loadedSheet: MoreSheet | undefined;
let sheetRequest: ReturnType<typeof importMoreSheet> | undefined;
let attempt = 0;
let refreshRequired = false;

async function importMoreSheet() {
  if (attempt++ === 0) return import("./MobileMoreSheet");

  // Reuse the current build's Vite modulepreload path with a fresh module key.
  const path = import.meta.env.DEV
    ? new URL(import.meta.url).pathname.replace(/MobileNav\.tsx$/, "MobileMoreSheet.tsx")
    : document.querySelector('link[rel="modulepreload"][href^="/assets/MobileMoreSheet-"]')
        ?.getAttribute("href");
  if (!path || (import.meta.env.PROD && !/^\/assets\/MobileMoreSheet-[\w-]+\.js$/.test(path))) {
    refreshRequired = true;
    return;
  }

  const specifier = `${path}?more-retry=${attempt}`;
  try {
    return await import(/* @vite-ignore */ specifier) as typeof import("./MobileMoreSheet");
  } catch {
    const resource = performance.getEntriesByName(location.origin + specifier)[0] as
      | PerformanceResourceTiming
      | undefined;
    const status = resource?.responseStatus;
    // An asset removed from this deployment needs a new document.
    refreshRequired = status === 404 || status === 410;
  }
}

export function MobileNav() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const [loadState, setLoadState] = useState<"idle" | "loading" | "error" | "open">("idle");
  const moreOpen = loadState === "open";
  const isChunkLoading = loadState === "loading";
  const pending = useRef<object | null>(null);
  const moreTriggerRef = useRef<HTMLButtonElement | null>(null);

  const {
    data: unreadCount,
    isLoading: isUnreadLoading,
    isError: isUnreadError,
  } = trpc.notifications.myUnreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const unreadBadgeInput = {
    count: unreadCount,
    isLoading: isUnreadLoading,
    isError: isUnreadError,
  };
  const unreadBadgeLabel = getUnreadBadgeLabel(unreadBadgeInput);
  const unreadBadgeAriaLabel = getUnreadBadgeAriaLabel(unreadBadgeInput);

  const activeNav = resolveActiveNavItem(
    [{ label: "오늘 실행", items: mobilePrimaryItems }],
    location
  );



  useLayoutEffect(() => {
    const events = new AbortController();
    const options = { signal: events.signal };
    const cancel = () => {
      pending.current = null;
      setLoadState("idle");
    };
    cancel();
    matchMedia("(min-width: 48rem)").addEventListener("change", cancel, options);
    window.addEventListener("keydown", event => {
      if (event.key === "Escape" && pending.current) {
        cancel();
      }
    }, options);
    return () => {
      pending.current = null;
      events.abort();
    };
  }, [location]);

  const openMore = async () => {
    if (pending.current) return;
    if (loadedSheet || refreshRequired) {
      setLoadState(loadedSheet ? "open" : "error");
      return;
    }

    const intent = {};
    pending.current = intent;
    setLoadState("loading");
    const module = await (sheetRequest ??= importMoreSheet().catch(() => undefined));
    sheetRequest = undefined;
    loadedSheet = module?.MobileMoreSheet;
    if (pending.current !== intent) return;
    pending.current = null;
    setLoadState(loadedSheet ? "open" : "error");
  };

  const renderNavButton = (item?: NavItem) => {
    const isMore = !item;
    const isActive = item ? activeNav?.item.path === item.path : moreOpen;
    const isNotif = item?.path === "/notifications";
    const isLoading = isMore && isChunkLoading;
    const Icon = item?.icon ?? Menu;

    return (
      <button
        key={item?.path ?? "more"}
        ref={isMore ? moreTriggerRef : undefined}
        type="button"
        data-testid={isActive ? "mobile-nav-active-item" : "mobile-nav-item"}
        data-active={isActive}
        aria-current={item && isActive ? "page" : undefined}
        aria-expanded={isMore ? moreOpen : undefined}
        aria-busy={isLoading || undefined}
        onClick={item ? () => setLocation(item.path) : openMore}
        className={cn(
          item && "relative",
          "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-semibold transition-[color,background-color,transform] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-primary/35 active:scale-[0.98]",
          isActive
            ? "bg-sidebar-primary/8 text-sidebar-primary"
            : "text-sidebar-foreground/70"
        )}
      >
        <span
          className={cn(
            item && "relative",
            "flex h-12 w-12 items-center justify-center rounded-lg",
            isActive && "bg-sidebar-primary/12 ring-1 ring-sidebar-primary/25"
          )}
        >
          {isLoading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <Icon className="h-5 w-5" />
          )}
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
          {item?.label ?? "더보기"}
        </span>
        {isLoading && (
          <span className="sr-only" role="status">
            더보기 메뉴 불러오는 중...
          </span>
        )}
      </button>
    );
  };

  const SheetComponent = loadedSheet;

  return (
    <>
      <nav
        data-testid="mobile-nav"
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar/98 text-sidebar-foreground shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md md:hidden dark:shadow-[0_-8px_28px_rgba(0,0,0,0.35)]"
      >
        <div className="grid min-h-[76px] grid-cols-5 gap-0.5 px-1 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-1.5">
          {mobilePrimaryItems.map(renderNavButton)}
          {renderNavButton()}
        </div>
      </nav>

      {/* In-place error banner when chunk download fails */}
      {loadState === "error" ? (
        <div
          role="alert"
          className="fixed bottom-[84px] left-3 right-3 z-50 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-card p-3 shadow-lg md:hidden"
        >
          <p className="text-sm text-foreground">
            더보기 메뉴를 불러오지 못했습니다.
            {(refreshRequired || attempt > 1) && " 계속 실패하면 페이지를 새로고침해 주세요."}
          </p>
          <div className="flex items-center gap-2">
            {!refreshRequired && (
              <button
                type="button"
                onClick={openMore}
                className="min-h-11 min-w-11 shrink-0 whitespace-nowrap rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                다시 시도
              </button>
            )}
            <button
              type="button"
              aria-label="알림 닫기"
              onClick={() => setLoadState("idle")}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}

      {/* Only rendered when chunk has been successfully loaded and More is open */}
      {SheetComponent && (
        <SheetComponent
          open={moreOpen}
          onOpenChange={open => setLoadState(open ? "open" : "idle")}
          user={user}
          logout={logout}
          triggerRef={moreTriggerRef}
        />
      )}
    </>
  );
}
