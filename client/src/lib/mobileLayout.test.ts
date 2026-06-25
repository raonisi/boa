import { describe, expect, it } from "vitest";

import { verticalGapBetweenRects } from "./layoutMetrics";
import {
  MOBILE_FIXED_ABOVE_NAV_BOTTOM,
  MOBILE_FIXED_ABOVE_NAV_GAP_PX,
  MOBILE_NAV_MIN_HEIGHT_PX,
} from "./mobileLayout";

describe("mobileLayout", () => {
  it("defines bottom offset above MobileNav with gap and safe-area", () => {
    expect(MOBILE_FIXED_ABOVE_NAV_BOTTOM).toContain(
      String(MOBILE_NAV_MIN_HEIGHT_PX)
    );
    expect(MOBILE_FIXED_ABOVE_NAV_BOTTOM).toContain(
      String(MOBILE_FIXED_ABOVE_NAV_GAP_PX)
    );
    expect(MOBILE_FIXED_ABOVE_NAV_BOTTOM).toContain("safe-area-inset-bottom");
  });

  it("computes vertical gap between stacked rects", () => {
    expect(verticalGapBetweenRects({ bottom: 100 }, { top: 108 })).toBe(8);
    expect(verticalGapBetweenRects({ bottom: 100 }, { top: 99 })).toBe(-1);
  });
});
