import { describe, expect, it } from "vitest";
import {
  canCreateScheduleForUser,
  canManageSchedule,
} from "./scheduleAuthorization";

describe("scheduleAuthorization", () => {
  it.each(["sub_branch_admin", "team_leader", "member"])(
    "allows %s to manage and create only own schedules",
    role => {
      expect(canManageSchedule({ id: 4, role }, { userId: 4 })).toBe(true);
      expect(canManageSchedule({ id: 4, role }, { userId: 5 })).toBe(false);
      expect(canCreateScheduleForUser({ id: 4, role }, 4)).toBe(true);
      expect(canCreateScheduleForUser({ id: 4, role }, 5)).toBe(false);
    }
  );

  it("allows branch_admin to create and manage schedules for other active users", () => {
    expect(
      canManageSchedule({ id: 1, role: "branch_admin" }, { userId: 4 })
    ).toBe(true);
    expect(canCreateScheduleForUser({ id: 1, role: "branch_admin" }, 4)).toBe(
      true
    );
  });
});
