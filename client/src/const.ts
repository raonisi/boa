export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getBrandedLoginConfigMessage } from "./lib/loginConfigurationCopy";

type LoginUrlSuccess = {
  ok: true;
  url: string;
};

type LoginUrlFailure = {
  ok: false;
  reason: "missing" | "invalid";
  message: string;
};

export type LoginUrlResult = LoginUrlSuccess | LoginUrlFailure;

const getGoogleClientId = () => {
  const value = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return typeof value === "string" ? value.trim() : "";
};

export function buildGoogleOAuthStartUrl({ origin }: { origin: string }) {
  const normalizedOrigin = origin.replace(/\/$/, "");
  return `${normalizedOrigin}/api/oauth/start`;
}

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrlResult = (): LoginUrlResult => {
  const googleClientId = getGoogleClientId();

  if (!googleClientId) {
    return {
      ok: false,
      reason: "missing",
      message: getBrandedLoginConfigMessage("missing"),
    };
  }

  try {
    return {
      ok: true,
      url: buildGoogleOAuthStartUrl({ origin: window.location.origin }),
    };
  } catch {
    return {
      ok: false,
      reason: "invalid",
      message: getBrandedLoginConfigMessage("invalid"),
    };
  }
};

export const getLoginUrl = () => {
  const result = getLoginUrlResult();
  return result.ok ? result.url : "";
};
