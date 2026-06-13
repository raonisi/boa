function maskLogPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return "[masked-phone]";
  if (digits.startsWith("02"))
    return `${digits.slice(0, 2)}-***-${digits.slice(-4)}`;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function maskLogEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!domain) return "[masked-email]";
  return `${local.slice(0, 1)}***@${domain}`;
}

export function sanitizeActivityLogText(value: string, maxLength = 160) {
  const sanitized = value
    .replace(/\b\d{6}-\d{7}\b/g, match => `${match.slice(0, 6)}-*******`)
    .replace(/\b(\d{4})[-/.](\d{2})[-/.](\d{2})\b/g, "$1-**-**")
    .replace(/\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, match =>
      maskLogPhone(match)
    )
    .replace(/\b02[-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, match => maskLogPhone(match))
    .replace(
      /\b([A-Z0-9._%+-])([A-Z0-9._%+-]*)(@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
      (_match, first, rest, domain) =>
        `${first}${"*".repeat(Math.max(3, String(rest).length))}${domain}`
    )
    .replace(
      /\b(?:token|accessToken|refreshToken|idToken|firebaseToken|deviceToken|fcmToken|secret|clientSecret|password|api[_-]?key|privateKey|DATABASE_URL|JWT_SECRET|authorization|cookie|session|credential|keyFile|googleClientSecret|firebaseAdmin)\s*[:=]\s*[^,\s"}]+/gi,
      "[REDACTED]"
    );
  return sanitized.length > maxLength
    ? `${sanitized.slice(0, maxLength)}...`
    : sanitized;
}

export function sanitizeActivityLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeActivityLogValue);
  if (typeof value === "string") return sanitizeActivityLogText(value);
  if (!value || typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (
      /(password|pass|token|accesstoken|refreshtoken|idtoken|firebasetoken|devicetoken|fcmtoken|secret|clientsecret|apikey|privatekey|serviceaccount|database_url|jwt_secret|authorization|cookie|session|credential|keyfile|googleclientsecret|firebaseadmin|openid|ssn|residentnumber|rrn|policy_number|policynumber)/i.test(
        normalizedKey
      )
    ) {
      result[key] = "[REDACTED]";
    } else if (
      /birth(date|day)?/i.test(normalizedKey) &&
      typeof item === "string"
    ) {
      const iso = item.trim().match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})$/);
      if (iso) {
        result[key] = `${iso[1]}-**-**`;
        continue;
      }
      const digits = item.replace(/\D/g, "");
      result[key] =
        digits.length === 6
          ? `${digits.slice(0, 2)}****`
          : digits.length >= 8
            ? `${digits.slice(0, 4)}****`
            : "[masked-birth-date]";
    } else if (
      /phone|contact|mobile|tel/i.test(normalizedKey) &&
      typeof item === "string"
    ) {
      result[key] = maskLogPhone(item);
    } else if (/email/i.test(normalizedKey) && typeof item === "string") {
      result[key] = maskLogEmail(item);
    } else if (/(premium|amount|fee)/i.test(normalizedKey)) {
      result[key] = "금액 정보 변경 [redacted]";
    } else if (
      /(content|body|scriptbody|templatebody|description|memo|message|note|productname|diseasename|illness|medical)/i.test(
        normalizedKey
      )
    ) {
      result[key] = "업무 상세 변경 [redacted]";
    } else {
      result[key] = sanitizeActivityLogValue(item);
    }
  }
  return result;
}

export function sanitizeActivityLogDetailsForStorage(details?: string | null) {
  if (!details) return details ?? null;
  try {
    return JSON.stringify(sanitizeActivityLogValue(JSON.parse(details)));
  } catch {
    return sanitizeActivityLogText(details, 240);
  }
}

export function sanitizeActivityLogRow<T extends { details?: string | null }>(
  entry: T
): T {
  return {
    ...entry,
    details: sanitizeActivityLogDetailsForStorage(entry.details),
    ...("ipAddress" in entry
      ? {
          ipAddress: (entry as any).ipAddress
            ? "[REDACTED]"
            : (entry as any).ipAddress,
        }
      : {}),
    ...("userAgent" in entry
      ? {
          userAgent: (entry as any).userAgent
            ? sanitizeActivityLogText(String((entry as any).userAgent), 80)
            : (entry as any).userAgent,
        }
      : {}),
  };
}
