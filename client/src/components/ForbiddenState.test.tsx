import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ForbiddenState } from "./ForbiddenState";
import { FORBIDDEN_UX } from "@/lib/userFacingMessages";

describe("ForbiddenState", () => {
  it("explains denied access without exposing customer or internal data", () => {
    const html = renderToStaticMarkup(<ForbiddenState />);

    expect(html).toContain(FORBIDDEN_UX.title);
    expect(html).toContain(FORBIDDEN_UX.description);
    expect(html).toContain(FORBIDDEN_UX.dashboardLabel);
    expect(html).toContain(FORBIDDEN_UX.backLabel);
    expect(html).not.toContain("Redirect");
    expect(html).not.toContain("token");
    expect(html).not.toContain("stack");
    expect(html).not.toContain("전화번호");
    expect(html).not.toContain("생년월일");
  });
});
