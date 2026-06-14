import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ForbiddenState } from "./ForbiddenState";

describe("ForbiddenState", () => {
  it("explains denied access without exposing customer or internal data", () => {
    const html = renderToStaticMarkup(
      <ForbiddenState description="이 화면은 지점 관리자 권한으로만 사용할 수 있습니다. 필요한 경우 관리자에게 문의해 주세요." />
    );

    expect(html).toContain("권한이 필요한 화면입니다.");
    expect(html).toContain("지점 관리자 권한");
    expect(html).toContain("홈으로 이동");
    expect(html).toContain("이전 화면");
    expect(html).not.toContain("Redirect");
    expect(html).not.toContain("token");
    expect(html).not.toContain("stack");
    expect(html).not.toContain("전화번호");
    expect(html).not.toContain("생년월일");
  });
});
