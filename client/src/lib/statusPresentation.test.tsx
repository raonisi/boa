import { describe, expect, it } from "vitest";
import {
  getExecutionBadgePresentation,
  getPriorityPresentation,
  getStatusPresentation,
  getStatusVariant,
  getUrgencyPresentation,
} from "./statusPresentation";

describe("statusPresentation", () => {
  it("maps all semantic variants for consult statuses", () => {
    expect(getStatusVariant("미상담")).toBe("neutral");
    expect(getStatusVariant("계약")).toBe("success");
    expect(getStatusVariant("거절")).toBe("danger");
    expect(getStatusVariant("부재")).toBe("warning");
  });

  it("falls back unknown enums to neutral with safe Korean label", () => {
    const presentation = getStatusPresentation("unexpected_status_code");
    expect(presentation.variant).toBe("neutral");
    expect(presentation.label).toBe("기타 상태");
    expect(presentation.label).not.toContain("unexpected_status_code");
  });

  it("falls back null or empty status to neutral", () => {
    expect(getStatusPresentation(null).variant).toBe("neutral");
    expect(getStatusPresentation(null).label).toBe("상태 미지정");
    expect(getStatusPresentation(undefined).variant).toBe("neutral");
  });

  it("uses inactive variant for account inactive and resigned", () => {
    expect(getStatusVariant("inactive")).toBe("inactive");
    expect(getStatusVariant("resigned")).toBe("inactive");
    expect(getStatusVariant("inactive")).not.toBe("success");
  });

  it("maps customer priority consistently", () => {
    expect(getPriorityPresentation("A").variant).toBe("danger");
    expect(getPriorityPresentation("unclassified").variant).toBe("neutral");
    expect(getPriorityPresentation("unclassified").label).toBe("미분류");
  });

  it("maps execution badges without guessing success for unknown labels", () => {
    expect(getExecutionBadgePresentation("미배정").variant).toBe("neutral");
    expect(getExecutionBadgePresentation("장기 미관리").variant).toBe("warning");
    expect(getExecutionBadgePresentation("배정 후 연락 필요").variant).toBe(
      "danger"
    );
    expect(getExecutionBadgePresentation("우선순위 미분류").variant).toBe(
      "warning"
    );
    expect(getExecutionBadgePresentation("알 수 없는 라벨").variant).toBe(
      "neutral"
    );
  });

  it("maps urgency without conflating medium and low", () => {
    expect(getUrgencyPresentation("high").variant).toBe("danger");
    expect(getUrgencyPresentation("medium").variant).toBe("warning");
    expect(getUrgencyPresentation("low").variant).toBe("neutral");
    expect(getUrgencyPresentation("unknown").variant).toBe("neutral");
  });
});
