import { describe, expect, it } from "vitest";
import {
  shouldQueueAccountStatusChange,
  shouldQueueUserRoleChange,
} from "./UserManagement";

describe("UserManagement confirm gating", () => {
  it("queues role confirm only when role actually changes", () => {
    expect(shouldQueueUserRoleChange("member", "member")).toBe(false);
    expect(shouldQueueUserRoleChange("member", "team_leader")).toBe(true);
  });

  it("queues account-status confirm only when status actually changes", () => {
    expect(shouldQueueAccountStatusChange("active", "active")).toBe(false);
    expect(shouldQueueAccountStatusChange("active", "inactive")).toBe(true);
    expect(shouldQueueAccountStatusChange("inactive", "resigned")).toBe(true);
  });
});
