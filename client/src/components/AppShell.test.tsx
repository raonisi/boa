import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AppShellLoading,
  AppShellNetworkError,
  AppShellRoot,
} from "./AppShell";

function visibleText(html: string) {
  return html.replace(/<[^>]+>/g, "");
}

describe("AppShell", () => {
  it("renders branded loading copy without browser or technical wording", () => {
    const html = renderToStaticMarkup(<AppShellLoading />);
    const text = visibleText(html);

    expect(html).toContain("app-shell-loading");
    expect(text).toContain("BOA 지점관리 CRM");
    expect(text).toContain("지점관리 환경을 준비하고 있습니다");
    expect(text).not.toContain("웹사이트를 여는 중");
    expect(text).not.toContain("브라우저");
    expect(text).not.toContain("tRPC");
    expect(text).not.toContain("stack");
  });

  it("renders safe offline copy and retry action", () => {
    const html = renderToStaticMarkup(<AppShellNetworkError />);
    const text = visibleText(html);

    expect(html).toContain("app-shell-network-error");
    expect(text).toContain("연결 상태를 확인해 주세요");
    expect(text).toContain("다시 시도");
    expect(text).not.toContain("403");
    expect(text).not.toContain("500");
    expect(text).not.toContain("DB 연결 오류");
  });

  it("wraps the app with a stable shell root", () => {
    const html = renderToStaticMarkup(
      <AppShellRoot>
        <main>업무 화면</main>
      </AppShellRoot>
    );

    expect(html).toContain("app-shell-root");
    expect(html).toContain("업무 화면");
  });
});
