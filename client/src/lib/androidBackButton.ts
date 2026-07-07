export const ANDROID_EXIT_PROMPT_MESSAGE =
  "한 번 더 누르면 앱을 종료합니다";

export const ANDROID_EXIT_PROMPT_WINDOW_MS = 2000;

export type AndroidBackAction =
  | "close-overlay"
  | "route-back"
  | "go-home"
  | "show-exit-prompt"
  | "exit-app";

type ResolveAndroidBackActionInput = {
  locationPath: string;
  hasRouteHistory: boolean;
  hasOpenOverlay: boolean;
  lastExitPromptAt: number | null;
  now: number;
  exitPromptWindowMs?: number;
};

const ROOT_BACK_PATHS = new Set(["/", "/dashboard"]);

function normalizePath(path: string) {
  const [pathname = "/"] = path.split(/[?#]/);
  if (!pathname) return "/";
  return pathname.endsWith("/") && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;
}

export function isRootBackExitPath(path: string) {
  return ROOT_BACK_PATHS.has(normalizePath(path));
}

export function resolveAndroidBackAction({
  locationPath,
  hasRouteHistory,
  hasOpenOverlay,
  lastExitPromptAt,
  now,
  exitPromptWindowMs = ANDROID_EXIT_PROMPT_WINDOW_MS,
}: ResolveAndroidBackActionInput): AndroidBackAction {
  if (hasOpenOverlay) return "close-overlay";

  if (!isRootBackExitPath(locationPath)) {
    return hasRouteHistory ? "route-back" : "go-home";
  }

  if (
    lastExitPromptAt !== null &&
    now - lastExitPromptAt <= exitPromptWindowMs
  ) {
    return "exit-app";
  }

  return "show-exit-prompt";
}

const OPEN_OVERLAY_SELECTORS = [
  '[data-slot="dialog-content"][data-state="open"]',
  '[data-slot="sheet-content"][data-state="open"]',
  '[data-slot="drawer-content"][data-state="open"]',
  '[data-slot="popover-content"][data-state="open"]',
  '[data-slot="dropdown-menu-content"][data-state="open"]',
  '[role="dialog"][data-state="open"]',
];

export function hasOpenBackDismissableLayer(doc: Document) {
  return OPEN_OVERLAY_SELECTORS.some(selector => doc.querySelector(selector));
}

export function closeTopBackDismissableLayer(doc: Document) {
  const target = doc.querySelector<HTMLElement>(
    OPEN_OVERLAY_SELECTORS.join(",")
  );

  if (!target) return false;

  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
      cancelable: true,
    })
  );
  return true;
}
