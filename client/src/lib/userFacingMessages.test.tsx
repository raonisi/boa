import { describe, expect, it } from "vitest";

import {
  getUserFacingErrorMessage,
  USER_FACING_ERRORS,
} from "./userFacingMessages";

describe("getUserFacingErrorMessage", () => {
  it("returns Korean server messages when safe", () => {
    expect(
      getUserFacingErrorMessage(
        new Error("권한 범위를 벗어난 요청입니다."),
        USER_FACING_ERRORS.permission
      )
    ).toBe("권한 범위를 벗어난 요청입니다.");
  });

  it("hides raw technical exceptions", () => {
    expect(
      getUserFacingErrorMessage(
        new Error("Failed to fetch at Object.handler (server.js:12:3)"),
        USER_FACING_ERRORS.loadFailed
      )
    ).toBe(USER_FACING_ERRORS.loadFailed);
  });

  it("hides English developer messages", () => {
    expect(
      getUserFacingErrorMessage(
        new Error("Unauthorized"),
        USER_FACING_ERRORS.permission
      )
    ).toBe(USER_FACING_ERRORS.permission);
  });
});
