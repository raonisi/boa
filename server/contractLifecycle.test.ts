import { describe, expect, it, vi } from "vitest";
import { recordContractLifecycleEvent } from "./contractLifecycle";

function createLifecycleDb(
  contract: { id: number; customerId: number; monthlyPremium: number | null } | null = {
    id: 10,
    customerId: 100,
    monthlyPremium: 120000,
  }
) {
  const limit = vi.fn().mockResolvedValue(contract ? [contract] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const values = vi.fn().mockResolvedValue([{ insertId: 77 }]);
  const insert = vi.fn(() => ({ values }));
  return { db: { select, insert } as any, values };
}

describe("recordContractLifecycleEvent", () => {
  it("derives customer and premium snapshot from the stored contract", async () => {
    const { db, values } = createLifecycleDb();
    const effectiveAt = new Date("2026-07-14T10:00:00.000Z");

    const event = await recordContractLifecycleEvent(db, {
      contractId: 10,
      actorId: 4,
      eventType: "deleted",
      effectiveAt,
      reason: "  [TEST] confirmed reason  ",
      sourceType: "delete_request",
      sourceId: 12,
      dedupeKey: "contract-delete-approved:12",
      metadata: {
        requestStatus: "approved",
        expectedImpact: "performance_exclusion",
        changedFields: ["isActive"],
        phone: "010-0000-0000",
        consultationBody: "must not be stored",
      },
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: 10,
        customerId: 100,
        monthlyPremiumSnapshot: 120000,
        actorId: 4,
        eventType: "deleted",
        effectiveAt,
        reason: "[TEST] confirmed reason",
        sourceId: 12,
        dedupeKey: "contract-delete-approved:12",
        metadata: {
          requestStatus: "approved",
          expectedImpact: "performance_exclusion",
          changedFields: ["isActive"],
        },
      })
    );
    expect(JSON.stringify(values.mock.calls[0]?.[0])).not.toContain("010-");
    expect(JSON.stringify(values.mock.calls[0]?.[0])).not.toContain(
      "consultationBody"
    );
    expect(event.id).toBe(77);
  });

  it("rejects invalid event types, actors, and missing contracts", async () => {
    const valid = createLifecycleDb();
    await expect(
      recordContractLifecycleEvent(valid.db, {
        contractId: 0,
        actorId: 4,
        eventType: "created",
        sourceType: "contract",
      })
    ).rejects.toThrow("valid contractId");
    await expect(
      recordContractLifecycleEvent(valid.db, {
        contractId: 10,
        actorId: 4,
        eventType: "terminated" as any,
        sourceType: "contract",
      })
    ).rejects.toThrow("Unsupported contract lifecycle event type");
    await expect(
      recordContractLifecycleEvent(valid.db, {
        contractId: 10,
        actorId: 0,
        eventType: "created",
        sourceType: "contract",
      })
    ).rejects.toThrow("valid actorId");
    await expect(
      recordContractLifecycleEvent(valid.db, {
        contractId: 10,
        actorId: 4,
        eventType: "created",
        sourceType: "merge" as any,
      })
    ).rejects.toThrow("Unsupported contract lifecycle source type");

    const missing = createLifecycleDb(null);
    await expect(
      recordContractLifecycleEvent(missing.db, {
        contractId: 10,
        actorId: 4,
        eventType: "created",
        sourceType: "contract",
      })
    ).rejects.toThrow("Contract not found");
  });

  it("keeps optional factual fields null when the source contract has no values", async () => {
    const { db, values } = createLifecycleDb({
      id: 10,
      customerId: 100,
      monthlyPremium: null,
    });
    values.mockResolvedValueOnce([]);

    const event = await recordContractLifecycleEvent(db, {
      contractId: 10,
      actorId: 4,
      eventType: "created",
      sourceType: "contract",
      metadata: { phone: "must not be stored" },
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        monthlyPremiumSnapshot: null,
        sourceId: null,
        dedupeKey: null,
        metadata: null,
      })
    );
    expect(event.id).toBe(0);
    expect(event.effectiveAt).toBeInstanceOf(Date);
  });

  it("propagates duplicate-key insertion failures to the surrounding transaction", async () => {
    const { db, values } = createLifecycleDb();
    values.mockRejectedValueOnce(new Error("duplicate dedupe key"));

    await expect(
      recordContractLifecycleEvent(db, {
        contractId: 10,
        actorId: 1,
        eventType: "restored",
        sourceType: "restore_action",
        sourceId: 10,
        dedupeKey: "contract-restored:10:2026-07-14",
      })
    ).rejects.toThrow("duplicate dedupe key");
  });
});
