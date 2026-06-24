import { describe, expect, it } from "vitest";
import { DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY } from "@shared/googleCalendar";
import {
  assertGoogleCalendarPayloadPolicy,
  buildGoogleCalendarDescription,
  buildGoogleCalendarTitle,
  buildSafeGoogleCalendarDescription,
  buildSafeGoogleCalendarLocation,
  buildSafeGoogleCalendarTitle,
  canIncludeContactInPersonalDescription,
  containsPhoneNumber,
  findForbiddenSecretPattern,
  findSensitiveCalendarPattern,
  mapBoaScheduleToGoogleCalendarType,
  resolvePersonalCalendarActorUserIds,
  sanitizeGoogleCalendarLogMetadata,
} from "./googleCalendarSafePayload";

const sampleContact = "010-1234-5678";
const sampleName = "홍길동";
const rawTitle = `${sampleName} ${sampleContact} 보장점검 상담`;
const rawDescription = `${sampleName} 고객 기존 보험 점검 후 재상담 예정. 연락처 ${sampleContact}`;

const fullRawPolicy = {
  syncRawTitleToGoogleCalendar: true,
  syncRawDescriptionToGoogleCalendar: true,
  allowCustomerNameInGoogleCalendar: true,
  allowCustomerContactInGoogleCalendar: true,
};

describe("googleCalendarSafePayload raw sync policy", () => {
  it("uses safe title when all policy flags are false (default)", () => {
    const title = buildGoogleCalendarTitle(
      {
        title: rawTitle,
        scheduleType: "고객상담",
        customerReference: "A-102",
        segmentLabel: "보장점검",
        rawTitle,
      },
      DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY
    );
    expect(title).toContain("[BOA]");
    expect(title).not.toContain(sampleName);
    expect(title).not.toContain(sampleContact);
  });

  it("reflects raw title when syncRawTitleToGoogleCalendar=true", () => {
    const title = buildGoogleCalendarTitle(
      { title: rawTitle, rawTitle },
      fullRawPolicy
    );
    expect(title).toBe(rawTitle);
  });

  it("reflects raw description when syncRawDescriptionToGoogleCalendar=true", () => {
    const description = buildGoogleCalendarDescription(
      { description: rawDescription, targetType: "shared_calendar" },
      fullRawPolicy
    );
    expect(description).toBe(rawDescription);
  });

  it("allows customer name in title when allowCustomerNameInGoogleCalendar=true", () => {
    const title = buildGoogleCalendarTitle(
      { title: `${sampleName} 보장점검` },
      {
        ...DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY,
        syncRawTitleToGoogleCalendar: true,
        allowCustomerNameInGoogleCalendar: true,
        allowCustomerContactInGoogleCalendar: true,
      }
    );
    expect(title).toContain(sampleName);
  });

  it("allows customer contact in description when allowCustomerContactInGoogleCalendar=true", () => {
    const description = buildGoogleCalendarDescription(
      { description: rawDescription, targetType: "shared_calendar" },
      fullRawPolicy
    );
    expect(description).toContain(sampleContact);
  });

  it("strips contact or falls back to safe title when contact not allowed", () => {
    const title = buildGoogleCalendarTitle(
      { title: rawTitle, scheduleType: "고객상담", customerReference: "A-102" },
      {
        syncRawTitleToGoogleCalendar: true,
        syncRawDescriptionToGoogleCalendar: false,
        allowCustomerNameInGoogleCalendar: true,
        allowCustomerContactInGoogleCalendar: false,
      }
    );
    expect(title).not.toContain(sampleContact);
    expect(title).toContain(sampleName);
  });

  it("blocks secrets even when raw sync is enabled", () => {
    expect(() =>
      assertGoogleCalendarPayloadPolicy(
        {
          title: "상담 일정",
          description: "access_token=abc123secretvalue",
        },
        fullRawPolicy
      )
    ).toThrow(/forbidden secret/i);
    expect(findForbiddenSecretPattern("refresh_token=xyz")).toBe(
      "forbidden_secret"
    );
  });

  it("does not store raw PII in activity log metadata", () => {
    const safe = sanitizeGoogleCalendarLogMetadata({
      calendarType: "consultation_followup",
      syncTargetType: "shared_calendar",
      boaEventType: "calendar_event",
      boaEventId: 55,
      syncStatus: "synced",
      targetUserId: 0,
      rawTitleSynced: true,
      rawDescriptionSynced: true,
      customerNameAllowed: true,
      customerContactAllowed: true,
      actorId: 1,
      title: rawTitle,
      description: rawDescription,
      customerName: sampleName,
      customerContact: sampleContact,
      refreshToken: "must-not-appear",
      accessToken: "must-not-appear",
    });
    expect(safe).not.toHaveProperty("title");
    expect(safe).not.toHaveProperty("description");
    expect(safe).not.toHaveProperty("customerName");
    expect(safe).not.toHaveProperty("customerContact");
    expect(safe).not.toHaveProperty("refreshToken");
    expect(safe).not.toHaveProperty("accessToken");
    expect(safe.rawTitleSynced).toBe(true);
    expect(safe.boaEventId).toBe(55);
  });

  it("scrubs phone and secrets from string metadata values", () => {
    const safe = sanitizeGoogleCalendarLogMetadata({
      safeErrorCode: "HTTP_403",
      lastErrorMessageSafe: `failed for ${sampleContact} access_token=abc`,
    });
    expect(String(safe.lastErrorMessageSafe)).not.toContain(sampleContact);
    expect(String(safe.lastErrorMessageSafe)).not.toMatch(/access_token/i);
  });
});

describe("googleCalendarSafePayload contact policy (legacy safe mode)", () => {
  const sampleTitle = buildSafeGoogleCalendarTitle({
    scheduleType: "고객상담",
    customerReference: "A-102",
    segmentLabel: "보장점검",
  });

  it("never allows contact in shared calendar title in safe mode", () => {
    expect(() =>
      buildSafeGoogleCalendarTitle({
        rawTitle: `${sampleContact} 상담`,
      })
    ).toThrow();
  });

  it("never allows contact in shared calendar description in safe mode", () => {
    const description = buildSafeGoogleCalendarDescription({
      targetType: "shared_calendar",
    });
    expect(description).not.toContain(sampleContact);
    expect(
      findSensitiveCalendarPattern(description, { field: "description" })
    ).toBeNull();
  });

  it("never allows contact in actor personal title or location", () => {
    expect(() => buildSafeGoogleCalendarLocation(sampleContact)).toThrow();
    expect(
      findSensitiveCalendarPattern(sampleTitle, { field: "title" })
    ).toBeNull();
    expect(
      findSensitiveCalendarPattern(`${sampleTitle} ${sampleContact}`, {
        field: "title",
      })
    ).toBe("phone_number");
  });

  it("includes contact in actor personal description only when legacy policy allows", () => {
    const without = buildSafeGoogleCalendarDescription({
      targetType: "actor_personal_calendar",
      includeCustomerContact: false,
      customerContact: sampleContact,
      viewerUserId: 4,
      createdBy: 4,
      ownerUserId: 5,
    });
    expect(without).not.toContain(sampleContact);

    const withContact = buildSafeGoogleCalendarDescription({
      targetType: "actor_personal_calendar",
      includeCustomerContact: true,
      customerContact: sampleContact,
      viewerUserId: 4,
      createdBy: 4,
      ownerUserId: 5,
    });
    expect(withContact).toContain("담당자 확인용 연락처");
    expect(withContact).toContain(sampleContact);
  });

  it("blocks non actor users from contact-bearing personal description", () => {
    expect(
      canIncludeContactInPersonalDescription({
        targetType: "actor_personal_calendar",
        includeCustomerContact: true,
        customerContact: sampleContact,
        viewerUserId: 99,
        createdBy: 4,
        ownerUserId: 5,
      })
    ).toBe(false);
  });

  it("allows createdBy and owner actors only", () => {
    expect(
      canIncludeContactInPersonalDescription({
        targetType: "actor_personal_calendar",
        includeCustomerContact: true,
        customerContact: sampleContact,
        viewerUserId: 4,
        createdBy: 4,
        ownerUserId: 5,
      })
    ).toBe(true);
    expect(
      canIncludeContactInPersonalDescription({
        targetType: "actor_personal_calendar",
        includeCustomerContact: true,
        customerContact: sampleContact,
        viewerUserId: 5,
        createdBy: 4,
        ownerUserId: 5,
      })
    ).toBe(true);
  });

  it("deduplicates personal actor user ids when creator equals owner", () => {
    expect(
      resolvePersonalCalendarActorUserIds({ createdBy: 4, ownerUserId: 4 })
    ).toEqual([4]);
  });

  it("blocks disease and premium in personal description even with contact allowed", () => {
    const description = buildSafeGoogleCalendarDescription({
      targetType: "actor_personal_calendar",
      includeCustomerContact: true,
      customerContact: sampleContact,
      viewerUserId: 4,
      createdBy: 4,
      ownerUserId: 4,
    });
    expect(
      findSensitiveCalendarPattern(description, {
        field: "description",
        allowCustomerContactInDescription: true,
      })
    ).toBeNull();

    expect(() =>
      buildSafeGoogleCalendarTitle({ rawTitle: "월 보험료 15만원 조정 상담" })
    ).toThrow();
    expect(
      findSensitiveCalendarPattern("김철수 피보험자 질병 상담", {
        field: "description",
      })
    ).toBe("customer_name");
  });

  it("maps consultation schedules to consultation_followup", () => {
    expect(
      mapBoaScheduleToGoogleCalendarType({ scheduleType: "고객상담" })
    ).toBe("consultation_followup");
  });

  it("detects phone numbers via helper", () => {
    expect(containsPhoneNumber("010-1234-5678")).toBe(true);
    expect(containsPhoneNumber("A-102")).toBe(false);
  });
});
