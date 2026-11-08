export type CustomerRequestKind = "consultation" | "followup";

export interface CustomerRequestContext {
  readonly requestCustomerId: number;
  readonly requestGeneration: number;
  readonly requestIdentity: number;
  readonly kind: CustomerRequestKind;
  readonly initiatingPromptToken: string | null;
  readonly dialogSession: number;
}

export interface CustomerRequestOptions {
  kind: CustomerRequestKind;
  generation: number;
  initiatingPromptToken: string | null;
  dialogSession: number;
}

export function createCustomerRequestOwnership() {
  let nextIdentity = 0;
  const contexts = new WeakMap<object, CustomerRequestContext>();
  const records = new WeakMap<CustomerRequestContext, { variables: object; pendingKey: string }>();
  const pending = new Map<string, CustomerRequestContext>();
  const latestIssued = new Map<string, number>();

  function begin<T extends { customerId: number }>(
    variables: T,
    options: CustomerRequestOptions
  ): CustomerRequestContext | null {
    const scope = JSON.stringify([options.kind, options.generation, variables.customerId]);
    const pendingKey = JSON.stringify([scope, variables]);
    if (pending.has(pendingKey)) return null;

    const context: CustomerRequestContext = Object.freeze({
      requestCustomerId: variables.customerId,
      requestGeneration: options.generation,
      requestIdentity: ++nextIdentity,
      kind: options.kind,
      initiatingPromptToken: options.initiatingPromptToken,
      dialogSession: options.dialogSession,
    });
    contexts.set(variables, context);
    records.set(context, { variables, pendingKey });
    pending.set(pendingKey, context);
    latestIssued.set(scope, context.requestIdentity);
    return context;
  }

  function contextFor(variables: object): CustomerRequestContext | undefined {
    return contexts.get(variables);
  }

  function isCurrent(
    context: CustomerRequestContext | null | undefined,
    customerId: number,
    generation: number
  ): boolean {
    return Boolean(
      context &&
      records.has(context) &&
      context.requestCustomerId === customerId &&
      context.requestGeneration === generation &&
      latestIssued.get(JSON.stringify([context.kind, generation, customerId])) === context.requestIdentity
    );
  }

  function settle(variables: object, context: CustomerRequestContext | null | undefined) {
    if (!context) return;
    const record = records.get(context);
    if (!record || record.variables !== variables) return;
    // A stale callback may release its own lock, never a replacement lock.
    if (pending.get(record.pendingKey) === context) pending.delete(record.pendingKey);
    if (contexts.get(variables) === context) contexts.delete(variables);
    // Retain latestIssued: settling the newest request cannot revive an older response.
  }

  return { begin, contextFor, isCurrent, settle };
}

export function ownsPrompt(
  context: CustomerRequestContext | null | undefined,
  activeToken: string | null
): boolean {
  return Boolean(
    context?.kind === "followup" &&
    context.initiatingPromptToken !== null &&
    context.initiatingPromptToken === activeToken
  );
}
