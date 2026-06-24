import { describe, expect, it } from "vitest";
import {
  getBrandedLoginConfigMessage,
  getLoginConfigurationNotice,
  LOGIN_CONFIG_INVALID_DESCRIPTION,
  LOGIN_CONFIG_MISSING_DESCRIPTION,
} from "./loginConfigurationCopy";

describe("loginConfigurationCopy", () => {
  it("uses safe copy for missing login configuration", () => {
    const notice = getLoginConfigurationNotice("missing");

    expect(notice.description).toBe(LOGIN_CONFIG_MISSING_DESCRIPTION);
    expect(notice.title).toContain("Google 로그인 설정");
    expect(notice.description).not.toMatch(/VITE_|GOOGLE_CLIENT|redirect_uri/i);
  });

  it("uses safe copy for invalid login configuration", () => {
    const notice = getLoginConfigurationNotice("invalid");

    expect(notice.description).toBe(LOGIN_CONFIG_INVALID_DESCRIPTION);
    expect(notice.description).not.toMatch(/VITE_|GOOGLE_CLIENT|redirect_uri/i);
  });

  it("maps branded login messages by reason", () => {
    expect(getBrandedLoginConfigMessage("missing")).toBe(
      LOGIN_CONFIG_MISSING_DESCRIPTION
    );
    expect(getBrandedLoginConfigMessage("invalid")).toBe(
      LOGIN_CONFIG_INVALID_DESCRIPTION
    );
  });
});
