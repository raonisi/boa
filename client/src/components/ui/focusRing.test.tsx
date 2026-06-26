import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Textarea } from "./textarea";

/**
 * BOA focus 표준: 주요 interactive control은 마우스 클릭이 아닌 키보드 포커스에서만
 * 보이는 focus-visible 링(두께 3px, ring-ring)을 사용한다.
 * 이 테스트는 표준이 약화/제거되지 않도록 회귀를 막는다.
 */
describe("focus ring consistency", () => {
  it("button uses focus-visible ring of 3px", () => {
    const html = renderToStaticMarkup(<Button>저장</Button>);
    expect(html).toContain("focus-visible:ring-[3px]");
    expect(html).toContain("focus-visible:ring-ring/45");
    expect(html).toContain("outline-none");
  });

  it("input uses focus-visible ring of 3px", () => {
    const html = renderToStaticMarkup(<Input aria-label="이름" />);
    expect(html).toContain("focus-visible:ring-[3px]");
    expect(html).toContain("focus-visible:border-ring");
  });

  it("textarea uses focus-visible ring of 3px", () => {
    const html = renderToStaticMarkup(<Textarea aria-label="메모" />);
    expect(html).toContain("focus-visible:ring-[3px]");
  });

  it("checkbox uses focus-visible ring of 3px and not legacy focus:ring-2", () => {
    const html = renderToStaticMarkup(
      <Checkbox checked={false} aria-label="선택" />
    );
    expect(html).toContain("focus-visible:ring-[3px]");
    expect(html).not.toContain("focus:ring-2");
  });
});
