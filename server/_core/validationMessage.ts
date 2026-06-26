import { ZodError } from "zod";

/**
 * 사용자 화면용 서버 입력검증 메시지.
 *
 * - Zod validation rule 자체는 변경하지 않는다. 이 모듈은 검증 "결과"를
 *   사용자에게 보여줄 안전한 한국어 문구로만 번역한다.
 * - path / expected / received / invalid_type 등 기술 detail은 노출하지 않는다.
 * - 권한/존재 여부/scope 오류는 별도 TRPCError(FORBIDDEN/NOT_FOUND 등)로
 *   처리되므로 이 모듈을 거치지 않는다.
 */
export const SERVER_VALIDATION_MESSAGES = {
  required: "필수 입력 항목입니다.",
  customerName: "고객명을 입력해 주세요.",
  assignee: "담당자를 선택해 주세요.",
  email: "이메일 형식을 확인해 주세요.",
  phone: "전화번호 형식을 확인해 주세요.",
  date: "날짜 형식을 확인해 주세요.",
  format: "입력 형식을 확인해 주세요.",
  range: "입력 가능한 범위를 확인해 주세요.",
  enum: "선택 가능한 항목을 확인해 주세요.",
  arrayMin: "하나 이상 선택해 주세요.",
  generic: "입력 내용을 확인해 주세요.",
} as const;

const HANGUL = /[가-힣]/;

/** Zod 기본 메시지·tRPC 내부 detail이 새어나오지 않도록 차단할 기술 패턴 */
const TECHNICAL_PATTERN =
  /(expected|received|invalid_type|invalid_union|unrecognized_keys|zod|nan|stack|TRPC|Error:|undefined|null|\bat\s)/i;

type LooseIssue = {
  code?: string;
  path?: Array<string | number>;
  message?: string;
  format?: string;
  validation?: string;
  origin?: string;
  type?: string;
  expected?: string;
  received?: string;
  minimum?: number | bigint;
};

function leafKey(path: Array<string | number> | undefined): string {
  if (!path?.length) return "";
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const segment = path[i];
    if (typeof segment === "string") return segment.toLowerCase();
  }
  return "";
}

function fieldSpecificFormatMessage(key: string): string | null {
  if (/(email|이메일)/.test(key)) return SERVER_VALIDATION_MESSAGES.email;
  if (/(phone|tel|mobile|연락처|전화)/.test(key))
    return SERVER_VALIDATION_MESSAGES.phone;
  if (/(date|time|일시|날짜|연락일)/.test(key))
    return SERVER_VALIDATION_MESSAGES.date;
  return null;
}

function fieldSpecificRequiredMessage(key: string): string | null {
  if (/(customername|고객명)/.test(key))
    return SERVER_VALIDATION_MESSAGES.customerName;
  if (/(agentid|assigneeid|managerid|owneruserid|담당)/.test(key))
    return SERVER_VALIDATION_MESSAGES.assignee;
  if (/(email|이메일)/.test(key)) return SERVER_VALIDATION_MESSAGES.email;
  if (/(phone|tel|mobile|연락처|전화)/.test(key))
    return SERVER_VALIDATION_MESSAGES.phone;
  return null;
}

function isArrayOrigin(issue: LooseIssue): boolean {
  return issue.origin === "array" || issue.type === "array";
}

function isNumberOrigin(issue: LooseIssue): boolean {
  return (
    issue.origin === "number" ||
    issue.origin === "bigint" ||
    issue.type === "number"
  );
}

function messageForIssue(issue: LooseIssue): string {
  const existing = typeof issue.message === "string" ? issue.message.trim() : "";
  if (existing && HANGUL.test(existing) && !TECHNICAL_PATTERN.test(existing)) {
    return existing;
  }

  const key = leafKey(issue.path);
  const format = (issue.format ?? issue.validation ?? "").toLowerCase();

  switch (issue.code) {
    case "invalid_string":
    case "invalid_format": {
      if (format === "email") return SERVER_VALIDATION_MESSAGES.email;
      if (format === "datetime" || format === "date" || format === "time")
        return SERVER_VALIDATION_MESSAGES.date;
      return (
        fieldSpecificFormatMessage(key) ?? SERVER_VALIDATION_MESSAGES.format
      );
    }

    case "too_small": {
      if (isArrayOrigin(issue)) return SERVER_VALIDATION_MESSAGES.arrayMin;
      if (isNumberOrigin(issue)) return SERVER_VALIDATION_MESSAGES.range;
      return (
        fieldSpecificRequiredMessage(key) ?? SERVER_VALIDATION_MESSAGES.required
      );
    }

    case "too_big": {
      return SERVER_VALIDATION_MESSAGES.range;
    }

    case "not_multiple_of": {
      return SERVER_VALIDATION_MESSAGES.range;
    }

    case "invalid_enum_value":
    case "invalid_value": {
      return SERVER_VALIDATION_MESSAGES.enum;
    }

    case "invalid_date": {
      return SERVER_VALIDATION_MESSAGES.date;
    }

    case "invalid_type": {
      const received = (issue.received ?? "").toLowerCase();
      const isMissing =
        received === "undefined" || received === "null" || received === "";
      const fieldMessage =
        fieldSpecificRequiredMessage(key) ?? fieldSpecificFormatMessage(key);
      if (fieldMessage) return fieldMessage;
      return isMissing
        ? SERVER_VALIDATION_MESSAGES.required
        : SERVER_VALIDATION_MESSAGES.generic;
    }

    default:
      return SERVER_VALIDATION_MESSAGES.generic;
  }
}

/**
 * ZodError를 사용자 화면용 안전 한국어 메시지로 변환한다.
 * 첫 번째 이슈를 기준으로 가장 구체적인 안내를 선택하며,
 * 매핑이 불명확하면 안전한 fallback을 사용한다.
 */
export function toKoreanValidationMessage(error: ZodError): string {
  const issues = (error?.issues ?? []) as LooseIssue[];
  if (!issues.length) return SERVER_VALIDATION_MESSAGES.generic;
  return messageForIssue(issues[0]!);
}

export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}
