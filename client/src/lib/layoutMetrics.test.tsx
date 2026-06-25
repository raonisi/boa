import { describe, expect, it } from "vitest";

import {
  documentHasHorizontalOverflow,
  meetsMinimumHitTarget,
  rectWithinViewport,
  rectsOverlap,
  verticalGapBetweenRects,
} from "./layoutMetrics";

describe("layoutMetrics", () => {
  it("detects horizontal document overflow with tolerance", () => {
    expect(documentHasHorizontalOverflow(1200, 1200)).toBe(false);
    expect(documentHasHorizontalOverflow(1202, 1200)).toBe(true);
    expect(documentHasHorizontalOverflow(1201, 1200, 2)).toBe(false);
  });

  it("checks whether a rectangle fits inside the viewport", () => {
    expect(
      rectWithinViewport(
        { top: 10, left: 8, bottom: 50, right: 120, width: 112, height: 40 },
        390,
        844
      )
    ).toBe(true);
    expect(
      rectWithinViewport(
        { top: 10, left: 8, bottom: 900, right: 120, width: 112, height: 890 },
        390,
        844
      )
    ).toBe(false);
  });

  it("detects overlapping rectangles", () => {
    const a = { top: 0, left: 0, bottom: 44, right: 44, width: 44, height: 44 };
    const b = { top: 20, left: 20, bottom: 64, right: 64, width: 44, height: 44 };
    expect(rectsOverlap(a, b)).toBe(true);
    expect(rectsOverlap(a, { top: 50, left: 0, bottom: 94, right: 44, width: 44, height: 44 })).toBe(
      false
    );
  });

  it("validates minimum hit target size", () => {
    expect(
      meetsMinimumHitTarget({
        top: 0,
        left: 0,
        bottom: 44,
        right: 44,
        width: 44,
        height: 44,
      }, 44)
    ).toBe(true);
    expect(
      meetsMinimumHitTarget({
        top: 0,
        left: 0,
        bottom: 24,
        right: 24,
        width: 24,
        height: 24,
      }, 44)
    ).toBe(false);
  });

  it("computes vertical gap between stacked rectangles", () => {
    expect(
      verticalGapBetweenRects(
        { top: 0, left: 0, bottom: 100, right: 10, width: 10, height: 100 },
        { top: 108, left: 0, bottom: 150, right: 10, width: 10, height: 42 }
      )
    ).toBe(8);
  });
});
