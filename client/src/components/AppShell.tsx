import boaLogoMark from "@/assets/brand/boa-logo-mark.png";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";
import React from "react";
import { useEffect, useState } from "react";

const APP_SHELL_TITLE = "BOA 지점관리 CRM";
const APP_SHELL_LOADING_DESCRIPTION = "지점관리 환경을 준비하고 있습니다";
const APP_SHELL_NETWORK_DESCRIPTION = "연결 상태를 확인해 주세요";

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine !== false;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

function useCapacitorShellClass() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousThemeColor = document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.getAttribute("content");
    let themeMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]'
    );
    const createdThemeMeta = !themeMeta;

    root.classList.add("boa-app-shell");
    body.classList.add("boa-app-shell-body");

    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute("content", "#f9f9f7");

    void import("@capacitor/core")
      .then(({ Capacitor }) => {
        root.classList.toggle("boa-capacitor-native", Capacitor.isNativePlatform());
        root.dataset.capacitorPlatform = Capacitor.getPlatform();
      })
      .catch(() => {
        root.classList.remove("boa-capacitor-native");
      });

    return () => {
      root.classList.remove("boa-app-shell", "boa-capacitor-native");
      body.classList.remove("boa-app-shell-body");
      delete root.dataset.capacitorPlatform;

      if (createdThemeMeta) {
        themeMeta?.remove();
      } else if (previousThemeColor && themeMeta) {
        themeMeta.setAttribute("content", previousThemeColor);
      }
    };
  }, []);
}

export function AppShellLoading({
  className,
  description = APP_SHELL_LOADING_DESCRIPTION,
}: {
  className?: string;
  description?: string;
}) {
  return (
    <div
      data-testid="app-shell-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "boa-app-shell-safe-area flex min-h-dvh items-center justify-center bg-background px-5 py-8 text-foreground",
        className
      )}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-card/95 p-6 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-1 shadow-sm ring-1 ring-border/70">
          <img
            src={boaLogoMark}
            alt="BOA"
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>
        <h1
          data-testid="app-shell-loading-title"
          className="mt-5 text-lg font-bold tracking-tight text-foreground"
        >
          {APP_SHELL_TITLE}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-primary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>준비 중</span>
        </div>
      </div>
    </div>
  );
}

export function AppShellNetworkError() {
  return (
    <div
      data-testid="app-shell-network-error"
      className="boa-app-shell-safe-area flex min-h-dvh items-center justify-center bg-background px-5 py-8 text-foreground"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-card/95 p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20">
          <WifiOff className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-lg font-bold tracking-tight text-foreground">
          {APP_SHELL_TITLE}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {APP_SHELL_NETWORK_DESCRIPTION}
        </p>
        <button
          type="button"
          data-testid="app-shell-retry"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          다시 시도
        </button>
      </div>
    </div>
  );
}

function AppShellNetworkBanner() {
  return (
    <div
      data-testid="app-shell-network-banner"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] px-3 pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-50 px-3 py-2 text-amber-950 shadow-sm">
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          {APP_SHELL_NETWORK_DESCRIPTION}
        </span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-bold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-amber-500/35"
        >
          새로고침
        </button>
      </div>
    </div>
  );
}

export function AppShellRoot({ children }: { children: React.ReactNode }) {
  const isOnline = useOnlineStatus();
  useCapacitorShellClass();

  return (
    <div
      data-testid="app-shell-root"
      className="boa-app-shell-root min-h-dvh bg-background text-foreground"
    >
      {isOnline ? null : <AppShellNetworkBanner />}
      {children}
    </div>
  );
}
