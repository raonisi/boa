import axios from "axios";
import { ENV } from "./_core/env";

export type GoogleCalendarEventInput = {
  calendarId: string;
  title: string;
  description: string;
  startTime: Date;
  endTime?: Date | null;
  timeZone?: string;
};

export type GoogleCalendarEventResult = {
  eventId: string;
};

export type GoogleCalendarAccessTestResult = {
  ok: boolean;
  errorCode?: string;
  errorMessageSafe?: string;
};

export interface GoogleCalendarApiClient {
  testCalendarAccess(
    accessToken: string,
    calendarId: string
  ): Promise<GoogleCalendarAccessTestResult>;
  createEvent(
    accessToken: string,
    input: GoogleCalendarEventInput
  ): Promise<GoogleCalendarEventResult>;
  updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    input: GoogleCalendarEventInput
  ): Promise<GoogleCalendarEventResult>;
  deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<void>;
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_TIMEZONE = "Asia/Seoul";

function toRfc3339(date: Date): string {
  return date.toISOString();
}

function sanitizeGoogleError(error: unknown): {
  errorCode: string;
  errorMessageSafe: string;
} {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const reason =
      (error.response?.data as { error?: { status?: string; message?: string } })
        ?.error?.status ??
      (error.response?.data as { error?: string })?.error ??
      "google_api_error";
    return {
      errorCode: status ? `HTTP_${status}` : String(reason).slice(0, 64),
      errorMessageSafe: "Google Calendar API 요청에 실패했습니다.",
    };
  }
  return {
    errorCode: "UNKNOWN",
    errorMessageSafe: "Google Calendar 연동 중 오류가 발생했습니다.",
  };
}

class AxiosGoogleCalendarApiClient implements GoogleCalendarApiClient {
  async testCalendarAccess(
    accessToken: string,
    calendarId: string
  ): Promise<GoogleCalendarAccessTestResult> {
    try {
      await axios.get(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?maxResults=1`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );
      return { ok: true };
    } catch (error) {
      const safe = sanitizeGoogleError(error);
      return {
        ok: false,
        errorCode: safe.errorCode,
        errorMessageSafe: safe.errorMessageSafe,
      };
    }
  }

  async createEvent(
    accessToken: string,
    input: GoogleCalendarEventInput
  ): Promise<GoogleCalendarEventResult> {
    const end = input.endTime ?? new Date(input.startTime.getTime() + 60 * 60 * 1000);
    try {
      const { data } = await axios.post<{ id?: string }>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`,
        {
          summary: input.title,
          description: input.description,
          start: {
            dateTime: toRfc3339(input.startTime),
            timeZone: input.timeZone ?? DEFAULT_TIMEZONE,
          },
          end: {
            dateTime: toRfc3339(end),
            timeZone: input.timeZone ?? DEFAULT_TIMEZONE,
          },
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }
      );
      if (!data.id) throw new Error("Missing event id");
      return { eventId: data.id };
    } catch (error) {
      const safe = sanitizeGoogleError(error);
      throw Object.assign(new Error(safe.errorMessageSafe), {
        code: safe.errorCode,
      });
    }
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    input: GoogleCalendarEventInput
  ): Promise<GoogleCalendarEventResult> {
    const end = input.endTime ?? new Date(input.startTime.getTime() + 60 * 60 * 1000);
    try {
      const { data } = await axios.patch<{ id?: string }>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          summary: input.title,
          description: input.description,
          start: {
            dateTime: toRfc3339(input.startTime),
            timeZone: input.timeZone ?? DEFAULT_TIMEZONE,
          },
          end: {
            dateTime: toRfc3339(end),
            timeZone: input.timeZone ?? DEFAULT_TIMEZONE,
          },
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }
      );
      return { eventId: data.id ?? eventId };
    } catch (error) {
      const safe = sanitizeGoogleError(error);
      throw Object.assign(new Error(safe.errorMessageSafe), {
        code: safe.errorCode,
      });
    }
  }

  async deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<void> {
    try {
      await axios.delete(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return;
      }
      const safe = sanitizeGoogleError(error);
      throw Object.assign(new Error(safe.errorMessageSafe), {
        code: safe.errorCode,
      });
    }
  }
}

let clientOverride: GoogleCalendarApiClient | null = null;

export function setGoogleCalendarApiClientForTests(
  client: GoogleCalendarApiClient | null
) {
  clientOverride = client;
}

export function getGoogleCalendarApiClient(): GoogleCalendarApiClient {
  return clientOverride ?? new AxiosGoogleCalendarApiClient();
}

export async function exchangeGoogleRefreshToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn?: number }> {
  if (!ENV.googleClientId || !ENV.googleClientSecret) {
    throw new Error("Google OAuth server environment is not configured");
  }
  const body = new URLSearchParams({
    client_id: ENV.googleClientId,
    client_secret: ENV.googleClientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const { data } = await axios.post<{
    access_token: string;
    expires_in?: number;
  }>(GOOGLE_TOKEN_URL, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 10000,
  });
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function exchangeGoogleCalendarAuthCode(
  code: string,
  redirectUri: string
): Promise<{ refreshToken?: string; accessToken: string; scope?: string }> {
  if (!ENV.googleClientId || !ENV.googleClientSecret) {
    throw new Error("Google OAuth server environment is not configured");
  }
  const body = new URLSearchParams({
    code,
    client_id: ENV.googleClientId,
    client_secret: ENV.googleClientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const { data } = await axios.post<{
    access_token: string;
    refresh_token?: string;
    scope?: string;
  }>(GOOGLE_TOKEN_URL, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 10000,
  });
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    scope: data.scope,
  };
}
