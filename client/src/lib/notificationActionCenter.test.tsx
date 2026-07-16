import { describe, expect, it } from "vitest";
import {
  classifyNotificationCategory,
  getNotificationActionCopy,
  resolveNotificationTarget,
} from "@shared/notificationActionCenter";

describe("notification action center metadata", () => {
  it("classifies every supported source into a stable category", () => {
    expect(
      classifyNotificationCategory({
        type: "general",
        relatedType: "schedule_change_request",
      })
    ).toBe("approval_admin");
    expect(
      classifyNotificationCategory({
        type: "schedule_incomplete",
        relatedType: "schedule",
      })
    ).toBe("schedule");
    expect(
      classifyNotificationCategory({
        type: "unpaid_lapse",
        relatedType: "contract",
      })
    ).toBe("customer_follow_up");
    expect(
      classifyNotificationCategory({ type: "general", relatedType: null })
    ).toBe("system");
  });

  it("resolves only allowlisted internal routes with valid ids", () => {
    expect(
      resolveNotificationTarget(
        { type: "reconsult", relatedType: "customer", relatedId: 42 },
        "member"
      )
    ).toEqual(
      expect.objectContaining({
        path: "/customers/42?action=quick-followup",
        basePath: "/customers/:id",
      })
    );
    expect(
      resolveNotificationTarget(
        { relatedType: "contract", relatedId: 7 },
        "member"
      )?.path
    ).toBe("/contracts");
    expect(
      resolveNotificationTarget(
        { relatedType: "schedule", relatedId: 8 },
        "member"
      )?.path
    ).toBe("/calendar");
    expect(
      resolveNotificationTarget(
        { relatedType: "customer", relatedId: -1 },
        "member"
      )
    ).toBeNull();
    expect(
      resolveNotificationTarget(
        { relatedType: "https://example.test", relatedId: 1 },
        "branch_admin"
      )
    ).toBeNull();
    expect(
      resolveNotificationTarget(
        {
          relatedType: "customer",
          relatedId: 1,
          targetAvailable: false,
        },
        "member"
      )
    ).toBeNull();
  });

  it("fails closed for administrator-only targets", () => {
    expect(
      resolveNotificationTarget(
        { relatedType: "delete_request", relatedId: 5 },
        "member"
      )
    ).toBeNull();
    expect(
      resolveNotificationTarget(
        { relatedType: "delete_request", relatedId: 5 },
        "branch_admin"
      )?.path
    ).toBe("/deleted-data");
    expect(
      resolveNotificationTarget(
        { relatedType: "schedule_change_request", relatedId: 6 },
        "member"
      )
    ).toBeNull();
  });

  it("keeps read state separate from source workflow copy", () => {
    expect(
      getNotificationActionCopy({
        actionRequired: true,
        sourceAvailable: true,
        sourceStatus: "pending",
      })
    ).toContain("처리 대기");
    expect(
      getNotificationActionCopy({
        actionRequired: false,
        sourceAvailable: false,
        sourceStatus: null,
        relatedType: "customer",
      })
    ).toBe("처리 대상을 확인할 수 없습니다.");
  });
});
