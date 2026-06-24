import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Checkbox } from "./checkbox";

describe("Checkbox touch target", () => {
  it("keeps minimum touch target class on root", () => {
    const html = renderToStaticMarkup(
      <Checkbox checked={false} aria-label="테스트 선택" />
    );

    expect(html).toContain("size-6");
  });

  it("can expand the interactive target without changing the visual box token", () => {
    const html = renderToStaticMarkup(
      <Checkbox touchTarget checked={false} aria-label="테스트 선택" />
    );

    expect(html).toContain("size-11");
    expect(html).toContain("before:size-6");
  });
});
