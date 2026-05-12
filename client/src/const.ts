export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

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

const REQUIRED_OAUTH_PORTAL_MESSAGE = "OAuth 로그인 URL 설정이 필요합니다.";
const INVALID_OAUTH_PORTAL_MESSAGE = "로그인 설정 URL이 올바르지 않습니다.";

const getOAuthPortalUrl = () => {
  const value = import.meta.env.VITE_OAUTH_PORTAL_URL;
  return typeof value === "string" ? value.trim() : "";
};

const buildPortalAuthUrl = (oauthPortalUrl: string) => {
  const portalUrl = new URL(oauthPortalUrl);

  if (portalUrl.protocol !== "https:" && portalUrl.protocol !== "http:") {
    throw new Error("Unsupported OAuth portal protocol");
  }

  const basePath = portalUrl.pathname.replace(/\/$/, "");
  return new URL(`${basePath}/app-auth`, portalUrl.origin);
};

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrlResult = (): LoginUrlResult => {
  const oauthPortalUrl = getOAuthPortalUrl();

  if (!oauthPortalUrl) {
    return {
      ok: false,
      reason: "missing",
      message: REQUIRED_OAUTH_PORTAL_MESSAGE,
    };
  }

  try {
    const appId = import.meta.env.VITE_APP_ID;
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(redirectUri);

    const url = buildPortalAuthUrl(oauthPortalUrl);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return { ok: true, url: url.toString() };
  } catch {
    return {
      ok: false,
      reason: "invalid",
      message: INVALID_OAUTH_PORTAL_MESSAGE,
    };
  }
};

export const getLoginUrl = () => {
  const result = getLoginUrlResult();
  return result.ok ? result.url : "";
};
