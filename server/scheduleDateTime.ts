const KST_OFFSET_MINUTES = 9 * 60;
const KST_OFFSET_MS = KST_OFFSET_MINUTES * 60 * 1000;
const LOCAL_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

export function parseKstLocalDateTime(value: string): Date {
  const localMatch = LOCAL_DATE_TIME_RE.exec(value);
  if (!localMatch) {
    return new Date(value);
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0", millisecondText = "0"] = localMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(millisecondText.padEnd(3, "0"));

  const utcTime = Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - KST_OFFSET_MS;
  const kstParts = new Date(utcTime + KST_OFFSET_MS);

  if (
    kstParts.getUTCFullYear() !== year ||
    kstParts.getUTCMonth() !== month - 1 ||
    kstParts.getUTCDate() !== day ||
    kstParts.getUTCHours() !== hour ||
    kstParts.getUTCMinutes() !== minute ||
    kstParts.getUTCSeconds() !== second
  ) {
    return new Date(Number.NaN);
  }

  return new Date(utcTime);
}

export function formatKstLocalDateTime(value: Date): string {
  const kst = new Date(value.getTime() + KST_OFFSET_MS);
  const pad = (part: number, length = 2) => String(part).padStart(length, "0");
  return [
    `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`,
    `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}`,
  ].join("T");
}
