import { Capacitor } from "@capacitor/core";
import { Loader2, LogIn, RefreshCw, WifiOff } from "lucide-react";
import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getLoginUrlResult } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  APP_SESSION_COPY,
  type AppSessionResumeStatus,
  isNetworkSessionError,
  isUnauthorizedSessionError,
  setAppSessionResumeRedirectSuppressed,
} from "@/lib/appSessionResume";

function canHandleNativeAppResume() {
  return (
    typeof window !== "undefined" &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "android"
  );
}

export function AppSessionStatusPanel({
  status,
  onRetry,
  onLogin,
}: {
  status: Exclude<AppSessionResumeStatus, "idle">;
  onRetry: () => void;
  onLogin: () => void;
}) {
  const isChecking = status === "checking";
  const isNetwork = status === "network";
  const title =
    status === "expired"
      ? APP_SESSION_COPY.expiredTitle
      : isNetwork
        ? APP_SESSION_COPY.networkTitle
        : APP_SESSION_COPY.checkingTitle;
  const description =
    status === "expired"
      ? APP_SESSION_COPY.expiredDescription
      : isNetwork
        ? APP_SESSION_COPY.networkDescription
        : APP_SESSION_COPY.checkingDescription;
  const testId =
    status === "expired"
      ? "app-session-expired"
      : isNetwork
        ? "app-session-network-error"
        : "app-session-checking";

  return (
    <div
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-busy={isChecking}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/88 px-5 py-8 text-foreground backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-card/95 p-6 text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          {isChecking ? (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          ) : isNetwork ? (
            <WifiOff className="h-6 w-6" aria-hidden="true" />
          ) : (
            <LogIn className="h-6 w-6" aria-hidden="true" />
          )}
        </div>
        <h1 className="mt-5 text-lg font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        {isChecking ? null : (
          <button
            type="button"
            data-testid={
              status === "expired"
                ? "app-session-login-button"
                : "app-session-retry"
            }
            onClick={status === "expired" ? onLogin : onRetry}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            {status === "expired" ? (
              <LogIn className="h-4 w-4" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            {status === "expired"
              ? APP_SESSION_COPY.loginButton
              : APP_SESSION_COPY.retryButton}
          </button>
        )}
      </div>
    </div>
  );
}

export function AppSessionResumeHandler() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<AppSessionResumeStatus>("idle");
  const isCheckingRef = useRef(false);
  const isNativeResumeEnabledRef = useRef(false);

  const checkSession = useCallback(async () => {
    if (!isNativeResumeEnabledRef.current || isCheckingRef.current) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setStatus("network");
      return;
    }

    isCheckingRef.current = true;
    setStatus("checking");
    setAppSessionResumeRedirectSuppressed(true);

    try {
      await utils.auth.me.fetch();
      setStatus("idle");
    } catch (error) {
      if (isUnauthorizedSessionError(error)) {
        utils.auth.me.setData(undefined, null);
        setStatus("expired");
      } else if (isNetworkSessionError(error)) {
        setStatus("network");
      } else {
        setStatus("network");
      }
    } finally {
      isCheckingRef.current = false;
      setAppSessionResumeRedirectSuppressed(false);
    }
  }, [utils]);

  useEffect(() => {
    if (!canHandleNativeAppResume()) return;

    isNativeResumeEnabledRef.current = true;
    const previousHandler = window.__boaHandleAppResume;
    window.__boaHandleAppResume = () => {
      void checkSession();
    };

    return () => {
      isNativeResumeEnabledRef.current = false;
      if (previousHandler) {
        window.__boaHandleAppResume = previousHandler;
      } else {
        delete window.__boaHandleAppResume;
      }
    };
  }, [checkSession]);

  const handleLogin = useCallback(() => {
    const loginUrl = getLoginUrlResult();
    if (!loginUrl.ok) return;
    window.location.href = loginUrl.url;
  }, []);

  return (
    <>
      <span hidden data-testid="app-session-resume-handler" />
      {status === "idle" ? null : (
        <AppSessionStatusPanel
          status={status}
          onRetry={() => void checkSession()}
          onLogin={handleLogin}
        />
      )}
    </>
  );
}
