import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, Clipboard, RefreshCw } from "lucide-react";
import React from "react";
import { useEffect, useMemo, useState } from "react";

export type AppVersionInfo = {
  ok: true;
  serviceName: "boa-crm";
  appVersion: string;
  commitShort: string | null;
  buildTime: string | null;
  environmentLabel: "production" | "development" | "test";
  serverStartTime: string;
};

type LoadState =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "ready"; data: AppVersionInfo; error?: undefined }
  | { status: "error"; data?: undefined; error: string };

function formatDateTime(value: string | null | undefined) {
  if (!value) return "미설정";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "미설정";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEnvironmentLabel(value: AppVersionInfo["environmentLabel"]) {
  if (value === "production") return "운영";
  if (value === "test") return "테스트";
  return "개발";
}

export function AppVersionCardView({
  state,
  copied = false,
  onCopy,
  className,
}: {
  state: LoadState;
  copied?: boolean;
  onCopy?: () => void;
  className?: string;
}) {
  const data = state.status === "ready" ? state.data : null;
  const copyDisabled = !data || !onCopy;

  return (
    <Card
      className={cn("border-dashed bg-muted/30 shadow-none", className)}
      data-testid="app-version-card"
    >
      <CardContent className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              앱 버전 정보
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              문제 제보 시 이 정보를 함께 전달해 주세요.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            onClick={onCopy}
            disabled={copyDisabled}
            data-testid="app-version-copy"
          >
            {copied ? (
              <Check className="mr-1 h-3.5 w-3.5" />
            ) : (
              <Clipboard className="mr-1 h-3.5 w-3.5" />
            )}
            {copied ? "복사됨" : "복사"}
          </Button>
        </div>

        {state.status === "loading" ? (
          <div
            className="flex items-center gap-2 text-xs text-muted-foreground"
            data-testid="app-version-loading"
          >
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            버전 정보를 확인하고 있습니다.
          </div>
        ) : state.status === "error" ? (
          <p className="text-xs text-muted-foreground" data-testid="app-version-error">
            버전 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">앱 버전</dt>
              <dd className="font-medium" data-testid="app-version-app-version">
                {data?.appVersion}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">배포 식별자</dt>
              <dd className="font-medium" data-testid="app-version-commit-short">
                {data?.commitShort ?? "미설정"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">빌드 시각</dt>
              <dd className="font-medium" data-testid="app-version-build-time">
                {formatDateTime(data?.buildTime)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">운영 환경</dt>
              <dd className="font-medium" data-testid="app-version-environment">
                {data ? getEnvironmentLabel(data.environmentLabel) : "-"}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

export function AppVersionCard({ className }: { className?: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    fetch("/api/version", {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error("version request failed");
        return (await response.json()) as AppVersionInfo;
      })
      .then(data => {
        setState({ status: "ready", data });
      })
      .catch(error => {
        if (error?.name === "AbortError") return;
        setState({
          status: "error",
          error: "version request failed",
        });
      });

    return () => controller.abort();
  }, []);

  const copyText = useMemo(() => {
    if (state.status !== "ready") return "";
    return [
      `BOA CRM ${state.data.appVersion}`,
      `배포 식별자: ${state.data.commitShort ?? "미설정"}`,
      `빌드 시각: ${formatDateTime(state.data.buildTime)}`,
      `운영 환경: ${getEnvironmentLabel(state.data.environmentLabel)}`,
    ].join("\n");
  }, [state]);

  const handleCopy = async () => {
    if (!copyText || !navigator.clipboard) return;
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <AppVersionCardView
      state={state}
      copied={copied}
      onCopy={state.status === "ready" ? handleCopy : undefined}
      className={className}
    />
  );
}
