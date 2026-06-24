export const CUSTOMER_DETAIL_ACTION_IDS = [
  "consult",
  "quick-followup",
  "followup",
  "contract",
  "message",
] as const;

export type CustomerDetailActionId =
  (typeof CUSTOMER_DETAIL_ACTION_IDS)[number];

export function parseCustomerDetailAction(
  raw: string | null | undefined
): CustomerDetailActionId | null | "invalid" {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (
    CUSTOMER_DETAIL_ACTION_IDS.includes(normalized as CustomerDetailActionId)
  ) {
    return normalized as CustomerDetailActionId;
  }
  return "invalid";
}

export function buildCustomerDetailPath(
  customerId: number,
  action?: CustomerDetailActionId
): string {
  if (!action) return `/customers/${customerId}`;
  return `/customers/${customerId}?action=${action}`;
}

export function applyCustomerDetailAction(
  action: CustomerDetailActionId,
  handlers: {
    onConsult: () => void;
    onQuickFollowup: () => void;
    onContract: () => void;
    onMessage: () => void;
  }
) {
  switch (action) {
    case "consult":
      handlers.onConsult();
      return;
    case "quick-followup":
    case "followup":
      handlers.onQuickFollowup();
      return;
    case "contract":
      handlers.onContract();
      return;
    case "message":
      handlers.onMessage();
      return;
    default:
      return;
  }
}
