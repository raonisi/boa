import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { UNAUTHED_ERR_MSG } from "@shared/const";

import {
  CUSTOMER_ACCESS_UX,
  FORBIDDEN_UX,
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
        new Error("Internal server error at Object.handler (server.js:12:3)"),
        USER_FACING_ERRORS.loadFailed
      )
    ).toBe(USER_FACING_ERRORS.loadFailed);
  });

  it("maps fetch failures to network copy", () => {
    expect(
      getUserFacingErrorMessage(
        new Error("Failed to fetch"),
        USER_FACING_ERRORS.loadFailed
      )
    ).toBe(USER_FACING_ERRORS.network);
  });

  it("hides English developer messages", () => {
    expect(
      getUserFacingErrorMessage(
        new Error("Unauthorized"),
        USER_FACING_ERRORS.permission
      )
    ).toBe(USER_FACING_ERRORS.permission);
  });

  it("maps tRPC UNAUTHORIZED to session expired copy", () => {
    const error = new TRPCClientError("x", {
      result: { error: { message: "x", code: -32001, data: { code: "UNAUTHORIZED" } } },
    });
    expect(getUserFacingErrorMessage(error)).toBe(
      USER_FACING_ERRORS.sessionExpired
    );
  });

  it("maps legacy unauth message to session expired copy", () => {
    expect(
      getUserFacingErrorMessage(new Error(UNAUTHED_ERR_MSG), undefined, "auth")
    ).toBe(USER_FACING_ERRORS.sessionExpired);
  });

  it("maps tRPC FORBIDDEN to permission copy for admin context", () => {
    const error = new TRPCClientError("x", {
      result: { error: { message: "x", code: -32003, data: { code: "FORBIDDEN" } } },
    });
    expect(getUserFacingErrorMessage(error, undefined, "admin")).toBe(
      USER_FACING_ERRORS.permission
    );
  });

  it("maps tRPC FORBIDDEN to customer-safe copy for customer context", () => {
    const error = new TRPCClientError("x", {
      result: { error: { message: "x", code: -32003, data: { code: "FORBIDDEN" } } },
    });
    expect(getUserFacingErrorMessage(error, undefined, "customer")).toBe(
      USER_FACING_ERRORS.customerNotFound
    );
  });

  it("maps BAD_REQUEST to validation copy when message is technical", () => {
    const error = new TRPCClientError("x", {
      result: {
        error: {
          message: "Invalid input",
          code: -32600,
          data: { code: "BAD_REQUEST" },
        },
      },
    });
    expect(getUserFacingErrorMessage(error)).toBe(USER_FACING_ERRORS.validation);
  });

  it("exposes standard forbidden and customer access copy constants", () => {
    expect(FORBIDDEN_UX.title).toBe("접근 권한이 없습니다");
    expect(FORBIDDEN_UX.description).toBe(USER_FACING_ERRORS.permission);
    expect(CUSTOMER_ACCESS_UX.title).toBe("정보를 확인할 수 없습니다");
    expect(CUSTOMER_ACCESS_UX.description).toBe(
      USER_FACING_ERRORS.customerNotFound
    );
  });
});
