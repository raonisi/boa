import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("native app session resume bridge", () => {
  it("keeps the Android package id and dispatches app resume without new auth storage", () => {
    const mainActivity = fs.readFileSync(
      "android/app/src/main/java/kr/raonisis/boa/MainActivity.java",
      "utf8"
    );
    const buildGradle = fs.readFileSync("android/app/build.gradle", "utf8");
    const packageJson = fs.readFileSync("package.json", "utf8");
    const resumeHandler = fs.readFileSync(
      "client/src/components/app/AppSessionResumeHandler.tsx",
      "utf8"
    );

    expect(mainActivity).toContain("package kr.raonisis.boa;");
    expect(buildGradle).toContain('applicationId "kr.raonisis.boa"');
    expect(mainActivity).toContain("public void onResume()");
    expect(mainActivity).toContain("__boaHandleAppResume");
    expect(packageJson).not.toContain('"@capacitor/app"');
    expect(resumeHandler).not.toContain("localStorage.setItem");
    expect(resumeHandler).not.toContain("sessionStorage.setItem");
    expect(resumeHandler).not.toContain("refresh token");
    expect(resumeHandler).not.toContain("access token");
  });
});
