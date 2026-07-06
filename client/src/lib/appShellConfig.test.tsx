import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import capacitorConfig from "../../../capacitor.config";

const projectRoot = path.resolve(import.meta.dirname, "..", "..", "..");

describe("Capacitor app shell config", () => {
  it("keeps the BOA Android identity unchanged", () => {
    expect(capacitorConfig.appId).toBe("kr.raonisis.boa");
    expect(capacitorConfig.appName).toBe("BOA 지점관리 CRM");
    expect(capacitorConfig.webDir).toBe("dist/public");
  });

  it("keeps native shell resources aligned with BOA app shell colors", () => {
    const styles = fs.readFileSync(
      path.join(projectRoot, "android/app/src/main/res/values/styles.xml"),
      "utf8"
    );
    const colors = fs.readFileSync(
      path.join(projectRoot, "android/app/src/main/res/values/colors.xml"),
      "utf8"
    );

    expect(styles).toContain("windowSplashScreenBackground");
    expect(styles).toContain("postSplashScreenTheme");
    expect(styles).toContain("android:statusBarColor");
    expect(styles).toContain("android:navigationBarColor");
    expect(colors).toContain("boa_shell_background");
    expect(colors).toContain("#f9f9f7");
  });

  it("preserves the Android application id", () => {
    const gradle = fs.readFileSync(
      path.join(projectRoot, "android/app/build.gradle"),
      "utf8"
    );

    expect(gradle).toContain('namespace = "kr.raonisis.boa"');
    expect(gradle).toContain('applicationId "kr.raonisis.boa"');
  });
});
