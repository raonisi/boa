const HANGUL = /[가-힣]/;
const RANGE_PATTERN =
  /(less than|greater than|too (small|big)|max|maximum|min|minimum|between|range)/i;
const REQUIRED_PATTERN =
  /(required|nonempty|too_small|string must contain at least|invalid_type.*undefined|expected .* received undefined)/i;
const FORMAT_PATTERN =
  /(invalid|email|url|regex|format|datetime|uuid|nan|number|boolean|string)/i;
const TECHNICAL_PATTERN =
  /(expected|received|code|zod|invalid_type|union|enum|path|stack|TRPC|Error:|at\s)/i;

export const VALIDATION_FALLBACK = {
  required: "필수 입력 항목입니다.",
  format: "입력 형식을 확인해 주세요.",
  range: "입력 가능한 범위를 확인해 주세요.",
  generic: "입력 내용을 확인해 주세요.",
} as const;

export function toSafeValidationMessage(message?: string | null): string {
  const normalized = typeof message === "string" ? message.trim() : "";
  if (!normalized) return VALIDATION_FALLBACK.generic;

  if (HANGUL.test(normalized) && !TECHNICAL_PATTERN.test(normalized)) {
    return normalized;
  }
  if (REQUIRED_PATTERN.test(normalized)) return VALIDATION_FALLBACK.required;
  if (RANGE_PATTERN.test(normalized)) return VALIDATION_FALLBACK.range;
  if (FORMAT_PATTERN.test(normalized)) return VALIDATION_FALLBACK.format;
  return VALIDATION_FALLBACK.generic;
}
