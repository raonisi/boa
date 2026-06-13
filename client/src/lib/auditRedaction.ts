export function redactAuditDisplayText(value: unknown, maxLength = 240) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const redacted = text
    .replace(/\b\d{6}-\d{7}\b/g, match => `${match.slice(0, 6)}-*******`)
    .replace(/\b(\d{4})[-/.](\d{2})[-/.](\d{2})\b/g, "$1-**-**")
    .replace(/\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, match => {
      const digits = match.replace(/\D/g, "");
      return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
    })
    .replace(/\b02[-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, match => {
      const digits = match.replace(/\D/g, "");
      return `${digits.slice(0, 2)}-***-${digits.slice(-4)}`;
    })
    .replace(
      /\b([A-Z0-9._%+-])([A-Z0-9._%+-]*)(@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
      (_match, first, rest, domain) =>
        `${first}${"*".repeat(Math.max(3, String(rest).length))}${domain}`
    )
    .replace(
      /\b(?:token|accessToken|refreshToken|idToken|firebaseToken|deviceToken|fcmToken|secret|clientSecret|password|api[_-]?key|privateKey|DATABASE_URL|JWT_SECRET|authorization|cookie|session|credential|keyFile|googleClientSecret|firebaseAdmin)\s*[:=]\s*[^,\s"}]+/gi,
      "[REDACTED]"
    );
  return redacted.length > maxLength
    ? `${redacted.slice(0, maxLength)}...`
    : redacted;
}
