import { describe, expect, it } from "vitest";

import { getGuideMeta, getRiskActionMeta } from "./OperationRiskCenter";

describe("operation risk action metadata", () => {
  it("maps risk cards to owner, deadline, and next-action guidance", () => {
    expect(getRiskActionMeta("download")).toMatchObject({
      owner: "지점장",
      deadline: "오늘 중",
    });
    expect(getRiskActionMeta("handoff").nextAction).toContain("인수인계");
    expect(getRiskActionMeta("approval").nextAction).toContain("충돌");
    expect(getRiskActionMeta("unknown")).toMatchObject({
      owner: "운영 담당",
      deadline: "오늘 중",
    });
  });

  it("maps action guide titles to the matching operational guidance", () => {
    expect(getGuideMeta("다운로드 사유 점검")).toMatchObject({
      owner: "지점장",
    });
    expect(getGuideMeta("푸시 실패 점검")).toMatchObject({
      owner: "운영 담당",
    });
    expect(getGuideMeta("삭제 요청 검토")).toMatchObject({ owner: "지점장" });
  });
});
