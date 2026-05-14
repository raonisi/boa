import { createHash } from "node:crypto";

export function hashDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function maskDeviceToken(token: string) {
  if (token.length <= 12) return "[masked-token]";
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}
