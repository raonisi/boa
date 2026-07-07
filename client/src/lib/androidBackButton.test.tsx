import { describe, expect, it } from "vitest";

import {
  ANDROID_EXIT_PROMPT_WINDOW_MS,
  isRootBackExitPath,
  resolveAndroidBackAction,
} from "./androidBackButton";

describe("android back button action resolution", () => {
  it("treats dashboard and root as exit-confirm paths", () => {
    expect(isRootBackExitPath("/")).toBe(true);
    expect(isRootBackExitPath("/dashboard")).toBe(true);
    expect(isRootBackExitPath("/dashboard?tab=today")).toBe(true);
    expect(isRootBackExitPath("/customers")).toBe(false);
  });

  it("prioritizes closing overlays before route movement or exit", () => {
    expect(
      resolveAndroidBackAction({
        locationPath: "/customers/1",
        hasRouteHistory: true,
        hasOpenOverlay: true,
        lastExitPromptAt: null,
        now: 1000,
      })
    ).toBe("close-overlay");
  });

  it("routes back on non-root screens when history exists", () => {
    expect(
      resolveAndroidBackAction({
        locationPath: "/calendar",
        hasRouteHistory: true,
        hasOpenOverlay: false,
        lastExitPromptAt: null,
        now: 1000,
      })
    ).toBe("route-back");
  });

  it("falls back to home on non-root direct entry without history", () => {
    expect(
      resolveAndroidBackAction({
        locationPath: "/notifications",
        hasRouteHistory: false,
        hasOpenOverlay: false,
        lastExitPromptAt: null,
        now: 1000,
      })
    ).toBe("go-home");
  });

  it("shows exit guidance on the first root back press", () => {
    expect(
      resolveAndroidBackAction({
        locationPath: "/",
        hasRouteHistory: true,
        hasOpenOverlay: false,
        lastExitPromptAt: null,
        now: 1000,
      })
    ).toBe("show-exit-prompt");
  });

  it("exits only when the second root back press is inside the window", () => {
    expect(
      resolveAndroidBackAction({
        locationPath: "/",
        hasRouteHistory: true,
        hasOpenOverlay: false,
        lastExitPromptAt: 1000,
        now: 1000 + ANDROID_EXIT_PROMPT_WINDOW_MS,
      })
    ).toBe("exit-app");

    expect(
      resolveAndroidBackAction({
        locationPath: "/",
        hasRouteHistory: true,
        hasOpenOverlay: false,
        lastExitPromptAt: 1000,
        now: 1000 + ANDROID_EXIT_PROMPT_WINDOW_MS + 1,
      })
    ).toBe("show-exit-prompt");
  });
});
