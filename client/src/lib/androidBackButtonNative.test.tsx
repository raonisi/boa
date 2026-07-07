import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..", "..", "..");

describe("android native back bridge", () => {
  it("keeps Android back handling inside MainActivity without changing app identity", () => {
    const mainActivity = fs.readFileSync(
      path.join(
        projectRoot,
        "android/app/src/main/java/kr/raonisis/boa/MainActivity.java"
      ),
      "utf8"
    );
    const gradle = fs.readFileSync(
      path.join(projectRoot, "android/app/build.gradle"),
      "utf8"
    );

    expect(mainActivity).toContain("package kr.raonisis.boa;");
    expect(mainActivity).toContain("__boaHandleAndroidBackButton");
    expect(mainActivity).toContain("finishAndRemoveTask()");
    expect(gradle).toContain('applicationId "kr.raonisis.boa"');
  });
});
