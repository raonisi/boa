import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppSessionStatusPanel,
} from "@/components/app/AppSessionResumeHandler";
import {
  APP_SESSION_COPY,
  isAppSessionResumeRedirectSuppressed,
  isNetworkSessionError,
  setAppSessionResumeRedirectSuppressed,
} from "./appSessionResume";

function visibleText(html: string) {
  return html.replace(/<[^>]+>/g, "");
}

describe("app session resume UX", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders safe checking, expired, and network copy without technical terms", () => {
    const statuses = ["checking", "expired", "network"] as const;

    for (const status of statuses) {
      const html = renderToStaticMarkup(
        <AppSessionStatusPanel
          status={status}
          onLogin={vi.fn()}
          onRetry={vi.fn()}
        />
      );
      const text = visibleText(html);

      expect(html).toContain(
        status === "expired"
          ? "app-session-expired"
          : status === "network"
            ? "app-session-network-error"
            : "app-session-checking"
      );
      expect(text).not.toContain("token expired");
      expect(text).not.toContain("JWT expired");
      expect(text).not.toContain("OAuth error");
      expect(text).not.toContain("401 Unauthorized");
      expect(text).not.toContain("403 Forbidden");
      expect(text).not.toContain("tRPC error");
      expect(text).not.toContain("session id");
      expect(text).not.toContain("cookie");
      expect(text).not.toContain("refresh token");
    }
  });

  it("uses login and retry CTA copy for terminal states", () => {
    const expiredHtml = renderToStaticMarkup(
      <AppSessionStatusPanel
        status="expired"
        onLogin={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    const networkHtml = renderToStaticMarkup(
      <AppSessionStatusPanel
        status="network"
        onLogin={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(visibleText(expiredHtml)).toContain(APP_SESSION_COPY.loginButton);
    expect(visibleText(networkHtml)).toContain(APP_SESSION_COPY.retryButton);
    expect(expiredHtml).toContain("app-session-login-button");
    expect(networkHtml).toContain("app-session-retry");
  });

  it("separates network failures from session expiry", () => {
    expect(isNetworkSessionError(new Error("Failed to fetch"))).toBe(true);
    expect(isNetworkSessionError(new Error("NetworkError when fetching"))).toBe(
      true
    );
    expect(isNetworkSessionError(new Error("로그인이 필요합니다."))).toBe(false);
  });

  it("suppresses auth redirects only during the resume check window", () => {
    vi.stubGlobal("window", {});

    setAppSessionResumeRedirectSuppressed(true);
    expect(isAppSessionResumeRedirectSuppressed()).toBe(true);

    setAppSessionResumeRedirectSuppressed(false);
    expect(isAppSessionResumeRedirectSuppressed()).toBe(false);
  });
});
