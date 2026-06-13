export const BOA_BUSINESS_TIME_ZONE = "Asia/Seoul";
export const DEFAULT_QUIET_HOURS_START = "21:00";
export const DEFAULT_QUIET_HOURS_END = "08:00";

const KST_OFFSET_MINUTES = 9 * 60;
const KST_OFFSET_MS = KST_OFFSET_MINUTES * 60 * 1000;
const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const LOCAL_TIME_RE = /^(\d{2}):(\d{2})$/;

export type KstDayRange = {
  dateKey: string;
  start: Date;
  end: Date;
};

function pad(part: number, length = 2) {
  return String(part).padStart(length, "0");
}

function invalidDate() {
  return new Date(Number.NaN);
}

function validateKstParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
) {
  const utcTime =
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond) -
    KST_OFFSET_MS;
  const kstParts = new Date(utcTime + KST_OFFSET_MS);
  if (
    kstParts.getUTCFullYear() !== year ||
    kstParts.getUTCMonth() !== month - 1 ||
    kstParts.getUTCDate() !== day ||
    kstParts.getUTCHours() !== hour ||
    kstParts.getUTCMinutes() !== minute ||
    kstParts.getUTCSeconds() !== second
  ) {
    return invalidDate();
  }
  return new Date(utcTime);
}

export function isLocalDateString(value: string) {
  if (!LOCAL_DATE_RE.test(value)) return false;
  return !Number.isNaN(parseKstLocalDate(value).getTime());
}

export function isLocalDateTimeString(value: string) {
  if (!LOCAL_DATE_TIME_RE.test(value)) return false;
  return !Number.isNaN(parseKstLocalDateTime(value).getTime());
}

export function parseKstLocalDate(value: string): Date {
  const match = LOCAL_DATE_RE.exec(value);
  if (!match) return invalidDate();
  const [, yearText, monthText, dayText] = match;
  return validateKstParts(Number(yearText), Number(monthText), Number(dayText));
}

export function parseKstLocalDateTime(value: string): Date {
  const dateOnlyMatch = LOCAL_DATE_RE.exec(value);
  if (dateOnlyMatch) return parseKstLocalDate(value);

  const localMatch = LOCAL_DATE_TIME_RE.exec(value);
  if (!localMatch) return new Date(value);

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText = "0",
    millisecondText = "0",
  ] = localMatch;
  return validateKstParts(
    Number(yearText),
    Number(monthText),
    Number(dayText),
    Number(hourText),
    Number(minuteText),
    Number(secondText),
    Number(millisecondText.padEnd(3, "0"))
  );
}

export function formatKstLocalDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`;
}

export function formatKstLocalDateTime(
  value: Date | string,
  options: { seconds?: boolean } = {}
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const datePart = `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`;
  const timePart = `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
  if (options.seconds === false) return `${datePart}T${timePart}`;
  return `${datePart}T${timePart}:${pad(kst.getUTCSeconds())}`;
}

export function formatKstLocalDateTimeForInput(value: Date | string): string {
  return formatKstLocalDateTime(value, { seconds: false });
}

export function mergeLocalDateAndTime(date: string, time: string) {
  if (!isLocalDateString(date) || !LOCAL_TIME_RE.test(time)) return "";
  return `${date}T${time}:00`;
}

export function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60 * 1000);
}

export function getScheduleReminderDueAt(
  startTime: Date,
  offsetMinutes: number
) {
  return addMinutes(startTime, -offsetMinutes);
}

export function getKstDayRange(value: Date | string = new Date()): KstDayRange {
  const dateKey =
    typeof value === "string" && isLocalDateString(value)
      ? value
      : formatKstLocalDate(value);
  const start = parseKstLocalDate(dateKey);
  return {
    dateKey,
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1),
  };
}

export function isSameKstDate(a: Date | string, b: Date | string) {
  return formatKstLocalDate(a) === formatKstLocalDate(b);
}

export function getKstLocalDateTimeAfter(
  base: Date,
  options: { days?: number; hours?: number; defaultHour?: number }
) {
  const local = new Date(base.getTime() + KST_OFFSET_MS);
  if (options.days) local.setUTCDate(local.getUTCDate() + options.days);
  if (options.defaultHour !== undefined) {
    local.setUTCHours(options.defaultHour, 0, 0, 0);
  } else if (options.hours) {
    local.setTime(local.getTime() + options.hours * 60 * 60 * 1000);
    local.setUTCSeconds(0, 0);
  }
  return formatKstLocalDateTime(
    validateKstParts(
      local.getUTCFullYear(),
      local.getUTCMonth() + 1,
      local.getUTCDate(),
      local.getUTCHours(),
      local.getUTCMinutes()
    ),
    { seconds: false }
  );
}

function toMinutes(value: string) {
  const match = LOCAL_TIME_RE.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function getZonedMinutes(now: Date, timezone = BOA_BUSINESS_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || BOA_BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find(part => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find(part => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function isInQuietHoursByPolicy(
  input: {
    quietHoursEnabled: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    timezone?: string | null;
  },
  now = new Date()
) {
  if (!input.quietHoursEnabled) return false;
  const start = toMinutes(input.quietHoursStart || DEFAULT_QUIET_HOURS_START);
  const end = toMinutes(input.quietHoursEnd || DEFAULT_QUIET_HOURS_END);
  if (start === null || end === null || start === end) return false;
  const current = getZonedMinutes(
    now,
    input.timezone || BOA_BUSINESS_TIME_ZONE
  );
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}
