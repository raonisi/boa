import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppVersionCardView } from "./AppVersionCard";

describe("AppVersionCardView", () => {
  it("renders safe version metadata without sensitive values", () => {
    const html = renderToStaticMarkup(
      <AppVersionCardView
        state={{
          status: "ready",
          data: {
            ok: true,
            serviceName: "boa-crm",
            appVersion: "1.0.0",
            commitShort: "abcdef1",
            buildTime: "2026-07-08T00:00:00.000Z",
            environmentLabel: "production",
            serverStartTime: "2026-07-08T00:01:00.000Z",
          },
        }}
        onCopy={() => undefined}
      />
    );

    expect(html).toContain("앱 버전 정보");
    expect(html).toContain("1.0.0");
    expect(html).toContain("abcdef1");
    expect(html).toContain("운영");
    expect(html).not.toContain("DATABASE_URL");
    expect(html).not.toContain("OAUTH_CLIENT_SECRET");
    expect(html).not.toContain("SESSION_SECRET");
    expect(html).not.toContain("token");
    expect(html).not.toContain("010-");
  });

  it("uses safe loading and error copy", () => {
    const loading = renderToStaticMarkup(
      <AppVersionCardView state={{ status: "loading" }} />
    );
    const error = renderToStaticMarkup(
      <AppVersionCardView
        state={{ status: "error", error: "version request failed" }}
      />
    );

    expect(loading).toContain("버전 정보를 확인하고 있습니다");
    expect(error).toContain("버전 정보를 불러오지 못했습니다");
    expect(error).not.toContain("version request failed");
  });
});
