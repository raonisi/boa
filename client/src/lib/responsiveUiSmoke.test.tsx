import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CUSTOMER_LIST_URL_PRESET_META } from "@/components/customers/customerListUrlPresets";
import { buildCustomerListPresetContext } from "@/lib/customerListPresetContext";
import { ErrorFallback } from "@/components/ErrorBoundary";
import { getAssignmentCandidateAvailability } from "@/lib/customerAssignAvailability";
import {
  shouldShowCustomerDetailLoadingShell,
  shouldShowCustomerDetailUnavailable,
} from "@/lib/customerDetailQueryGating";

describe("responsive UI smoke helpers", () => {
  it("keeps ErrorBoundary user copy safe in all builds", () => {
    const error = new Error("raw technical failure");
    error.stack = "Error: raw technical failure\n    at Secret.tsx:1:1";
    const html = renderToStaticMarkup(<ErrorFallback error={error} />);

    expect(html).toContain("문제가 발생했습니다.");
    expect(html).not.toContain("raw technical failure");
    expect(html).not.toContain("Secret.tsx");
  });

  it("maps customer assign disabled reasons for account status", () => {
    expect(getAssignmentCandidateAvailability("inactive").disabledReason).toBe(
      "비활성 계정입니다"
    );
    expect(getAssignmentCandidateAvailability("resigned").disabledReason).toBe(
      "퇴사 처리된 사용자입니다"
    );
    expect(
      getAssignmentCandidateAvailability("active", { isCurrentAssignee: true })
        .disabledReason
    ).toBe("현재 담당자입니다");
  });

  it("keeps customer list preset titles user-facing", () => {
    expect(CUSTOMER_LIST_URL_PRESET_META["priority-contact"].title).toBe(
      "우선 연락 고객"
    );
    expect(CUSTOMER_LIST_URL_PRESET_META["priority-contact"].description).not.toContain(
      "priority-contact"
    );
    expect(buildCustomerListPresetContext("priority-contact", false).title).toBe(
      "현재 보기: 우선 연락 고객"
    );
  });

  it("shows unavailable state when customer id does not match loaded record", () => {
    expect(
      shouldShowCustomerDetailUnavailable({
        customerId: 202,
        customer: { id: 101 },
        isLoading: false,
        isError: false,
      })
    ).toBe(false);
    expect(
      shouldShowCustomerDetailLoadingShell({
        customerId: 202,
        customer: { id: 101 },
        isLoading: false,
        isError: false,
      })
    ).toBe(true);
  });
});
