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

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const getGoogleClientId = () => {
  const value = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return typeof value === "string" ? value.trim() : "";
};

export function buildGoogleAuthorizeUrl({
  clientId,
  origin,
}: {
  clientId: string;
  origin: string;
}) {
  const normalizedClientId = clientId.trim();
  const normalizedOrigin = origin.replace(/\/$/, "");

  if (!normalizedClientId) {
    throw new Error("Google client ID is required");
  }

  const redirectUri = `${normalizedOrigin}/api/oauth/callback`;
  const state = btoa(redirectUri);
  const url = new URL(GOOGLE_AUTHORIZE_URL);

  url.searchParams.set("client_id", normalizedClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  return url.toString();
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
      url: buildGoogleAuthorizeUrl({
        clientId: googleClientId,
        origin: window.location.origin,
      }),
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
