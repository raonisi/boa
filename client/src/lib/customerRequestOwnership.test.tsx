import { describe, expect, it } from "vitest";
import {
  createCustomerRequestOwnership,
  ownsPrompt,
  type CustomerRequestOptions,
} from "./customerRequestOwnership";

const options = (overrides: Partial<CustomerRequestOptions> = {}): CustomerRequestOptions => ({
  kind: "followup",
  generation: 7,
  initiatingPromptToken: "prompt-A",
  dialogSession: 1,
  ...overrides,
});

describe("customer request ownership", () => {
  it("F01 lets an owned followup close exactly its initiating prompt", () => {
    const owner = createCustomerRequestOwnership();
    const variables = { customerId: 101, reason: "[TEST] call" };
    const context = owner.begin(variables, options())!;
    expect(owner.isCurrent(context, 101, 7)).toBe(true);
    expect(ownsPrompt(context, "prompt-A")).toBe(true);
    owner.settle(variables, context);
    expect(owner.contextFor(variables)).toBeUndefined();
    expect(ownsPrompt(context, null)).toBe(false);
  });

  it("F02 cannot apply A's held response to B's new screen or prompt", () => {
    const owner = createCustomerRequestOwnership();
    const a = owner.begin({ customerId: 101, reason: "[TEST] held A" }, options())!;
    const b = owner.begin({ customerId: 102, status: "통화완료" }, options({
      kind: "consultation", generation: 8, initiatingPromptToken: null,
    }))!;
    expect(owner.isCurrent(a, 102, 8)).toBe(false);
    expect(ownsPrompt(a, "prompt-B")).toBe(false);
    expect(owner.isCurrent(b, 102, 8)).toBe(true);
  });

  it("F03 keeps an older prompt token from closing a newer prompt for the same customer", () => {
    const owner = createCustomerRequestOwnership();
    const older = owner.begin({ customerId: 101, reason: "[TEST] held" }, options())!;
    owner.begin({ customerId: 101, status: "상담예정" }, options({
      kind: "consultation", initiatingPromptToken: null,
    }));
    // Consultation and followup identities are separate; token ownership is also required.
    expect(owner.isCurrent(older, 101, 7)).toBe(true);
    expect(ownsPrompt(older, "prompt-new")).toBe(false);
    expect(older.initiatingPromptToken).toBe("prompt-A");
  });

  it("F04 treats a null initiating token as no ownership of any later prompt", () => {
    const owner = createCustomerRequestOwnership();
    const held = owner.begin({ customerId: 101, reason: "[TEST] ordinary quick followup" }, options({
      initiatingPromptToken: null,
    }))!;
    owner.begin({ customerId: 101, status: "통화완료" }, options({
      kind: "consultation", initiatingPromptToken: null,
    }));
    expect(owner.isCurrent(held, 101, 7)).toBe(true);
    expect(ownsPrompt(held, "new-consultation-prompt")).toBe(false);
    expect(ownsPrompt(held, null)).toBe(false);
  });

  it("does not grant prompt ownership to consultation or missing contexts", () => {
    const owner = createCustomerRequestOwnership();
    const consultation = owner.begin({ customerId: 101, status: "통화완료" }, options({ kind: "consultation" }))!;
    expect(ownsPrompt(consultation, "prompt-A")).toBe(false);
    expect(ownsPrompt(null, "prompt-A")).toBe(false);
    expect(ownsPrompt(undefined, null)).toBe(false);
  });

  it("accepts only the latest same-customer consultation response, even after it settles", () => {
    const owner = createCustomerRequestOwnership();
    const firstVariables = { customerId: 101, status: "통화완료" };
    const secondVariables = { customerId: 101, status: "상담예정" };
    const first = owner.begin(firstVariables, options({ kind: "consultation" }))!;
    const second = owner.begin(secondVariables, options({ kind: "consultation" }))!;
    expect(second.requestIdentity).toBeGreaterThan(first.requestIdentity);
    expect(owner.isCurrent(first, 101, 7)).toBe(false);
    expect(owner.isCurrent(second, 101, 7)).toBe(true);
    owner.settle(secondVariables, second);
    expect(owner.isCurrent(first, 101, 7)).toBe(false);
    expect(owner.isCurrent(second, 101, 7)).toBe(true);
    owner.settle(firstVariables, first);
    expect(owner.isCurrent(first, 101, 7)).toBe(false);
  });

  it("rejects A/B/A callbacks from a previous screen generation", () => {
    const owner = createCustomerRequestOwnership();
    const aBefore = owner.begin({ customerId: 101, status: "통화완료" }, options({ kind: "consultation" }))!;
    const b = owner.begin({ customerId: 102, status: "통화완료" }, options({ kind: "consultation", generation: 8 }))!;
    const aAfter = owner.begin({ customerId: 101, status: "통화완료" }, options({ kind: "consultation", generation: 9 }))!;
    expect(owner.isCurrent(aBefore, 101, 9)).toBe(false);
    expect(owner.isCurrent(b, 101, 9)).toBe(false);
    expect(owner.isCurrent(aAfter, 101, 9)).toBe(true);
  });

  it("blocks an identical pending payload synchronously, including a new dialog session", () => {
    const owner = createCustomerRequestOwnership();
    const variables = { customerId: 101, reason: "[TEST] same" };
    const first = owner.begin(variables, options())!;
    const duplicate = { ...variables };
    expect(owner.begin(duplicate, options({ dialogSession: 2, initiatingPromptToken: "new-token" }))).toBeNull();
    expect(owner.begin(variables, options())).toBeNull();
    expect(owner.contextFor(variables)).toBe(first);
    expect(owner.contextFor(duplicate)).toBeUndefined();
  });

  it("permits a different payload, customer, kind, or generation while another request is pending", () => {
    const owner = createCustomerRequestOwnership();
    const first = owner.begin({ customerId: 101, reason: "[TEST] one" }, options())!;
    const differentPayload = owner.begin({ customerId: 101, reason: "[TEST] two" }, options())!;
    const differentCustomer = owner.begin({ customerId: 102, reason: "[TEST] one" }, options())!;
    const differentKind = owner.begin({ customerId: 101, reason: "[TEST] one" }, options({ kind: "consultation" }))!;
    const differentGeneration = owner.begin({ customerId: 101, reason: "[TEST] one" }, options({ generation: 8 }))!;
    const contexts = [first, differentPayload, differentCustomer, differentKind, differentGeneration];
    expect(contexts.every(Boolean)).toBe(true);
    expect(contexts.map(context => context.requestIdentity)).toEqual([1, 2, 3, 4, 5]);
    expect(owner.isCurrent(first, 101, 7)).toBe(false);
    expect(owner.isCurrent(differentPayload, 101, 7)).toBe(true);
    expect(owner.isCurrent(differentKind, 101, 7)).toBe(true);
  });

  it("releases settled success/error requests and permits normal subsequent retries", () => {
    const owner = createCustomerRequestOwnership();
    const variables = { customerId: 101, reason: "[TEST] retry" };
    const success = owner.begin(variables, options())!;
    owner.settle(variables, success);
    const error = owner.begin(variables, options())!;
    expect(error.requestIdentity).toBeGreaterThan(success.requestIdentity);
    owner.settle(variables, error);
    const retry = owner.begin(variables, options())!;
    expect(retry.requestIdentity).toBeGreaterThan(error.requestIdentity);
    expect(owner.contextFor(variables)).toBe(retry);
  });

  it("does not let a repeated old settlement release the replacement request's lock", () => {
    const owner = createCustomerRequestOwnership();
    const oldVariables = { customerId: 101, reason: "[TEST] same payload" };
    const older = owner.begin(oldVariables, options())!;
    owner.settle(oldVariables, older);
    const newVariables = { ...oldVariables };
    const newer = owner.begin(newVariables, options())!;
    owner.settle(oldVariables, older);
    expect(owner.begin({ ...newVariables }, options())).toBeNull();
    expect(owner.contextFor(newVariables)).toBe(newer);
    expect(owner.isCurrent(newer, 101, 7)).toBe(true);
  });

  it("requires the originating variables object, not an equal copy, to settle a request", () => {
    const owner = createCustomerRequestOwnership();
    const variables = { customerId: 101, reason: "[TEST] identity" };
    const context = owner.begin(variables, options())!;
    const copy = { ...variables };
    expect(owner.contextFor(copy)).toBeUndefined();
    owner.settle(copy, context);
    expect(owner.contextFor(variables)).toBe(context);
    expect(owner.begin(copy, options())).toBeNull();
    owner.settle(variables, context);
    expect(owner.begin(copy, options())).not.toBeNull();
  });

  it("does not accept a copied context as current or as a lock owner", () => {
    const owner = createCustomerRequestOwnership();
    const variables = { customerId: 101, reason: "[TEST] context" };
    const context = owner.begin(variables, options())!;
    const forged = Object.freeze({ ...context });
    expect(owner.isCurrent(forged, 101, 7)).toBe(false);
    owner.settle(variables, forged);
    owner.settle(variables, null);
    owner.settle(variables, undefined);
    expect(owner.begin({ ...variables }, options())).toBeNull();
    expect(owner.contextFor(variables)).toBe(context);
    expect(owner.isCurrent(null, 101, 7)).toBe(false);
    expect(owner.isCurrent(undefined, 101, 7)).toBe(false);
  });

  it("keeps immutable request identity and prompt ownership when inputs later change", () => {
    const owner = createCustomerRequestOwnership();
    const variables = { customerId: 101, reason: "[TEST] immutable" };
    const initiating = options();
    const context = owner.begin(variables, initiating)!;
    variables.customerId = 102;
    initiating.generation = 8;
    initiating.initiatingPromptToken = null;
    initiating.dialogSession = 2;
    expect(Object.isFrozen(context)).toBe(true);
    expect(Reflect.set(context, "requestCustomerId", 999)).toBe(false);
    expect(context).toEqual({
      requestCustomerId: 101, requestGeneration: 7, requestIdentity: 1,
      kind: "followup", initiatingPromptToken: "prompt-A", dialogSession: 1,
    });
    expect(owner.isCurrent(context, 101, 7)).toBe(true);
    expect(owner.isCurrent(context, 102, 7)).toBe(false);
    expect(owner.isCurrent(context, 101, 8)).toBe(false);
  });

  it("settles an older use of one variables object without deleting its newer context mapping", () => {
    const owner = createCustomerRequestOwnership();
    const variables = { customerId: 101, reason: "[TEST] old" };
    const first = owner.begin(variables, options())!;
    variables.reason = "[TEST] new";
    const second = owner.begin(variables, options())!;
    owner.settle(variables, first);
    expect(owner.contextFor(variables)).toBe(second);
    expect(owner.begin({ ...variables }, options())).toBeNull();
    expect(owner.begin({ customerId: 101, reason: "[TEST] old" }, options())).not.toBeNull();
  });

  it("does not release a different request when a real but mismatched context is supplied", () => {
    const owner = createCustomerRequestOwnership();
    const aVariables = { customerId: 101, reason: "[TEST] A" };
    const bVariables = { customerId: 102, reason: "[TEST] B" };
    const a = owner.begin(aVariables, options())!;
    const b = owner.begin(bVariables, options())!;
    owner.settle(aVariables, b);
    expect(owner.contextFor(aVariables)).toBe(a);
    expect(owner.contextFor(bVariables)).toBe(b);
    expect(owner.begin({ ...aVariables }, options())).toBeNull();
    expect(owner.begin({ ...bVariables }, options())).toBeNull();
  });
});
