import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

function getRequestHostname(req: Request) {
  const hostname = req.hostname;
  if (hostname) return hostname;

  const hostHeader = req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  return host?.split(":")[0] ?? "";
}

function isLocalDevelopmentRequest(req: Request) {
  const hostname = getRequestHostname(req);
  return (
    process.env.NODE_ENV === "development" ||
    LOCAL_HOSTS.has(hostname) ||
    isIpAddress(hostname)
  );
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const isLocal = isLocalDevelopmentRequest(req);

  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isLocal ? false : isSecureRequest(req),
  };
}
