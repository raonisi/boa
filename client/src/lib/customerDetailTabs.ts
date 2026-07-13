export const CUSTOMER_DETAIL_TAB_VALUES = [
  "summary",
  "consultation",
  "contracts",
  "schedule",
  "history",
] as const;

export type CustomerDetailTab = (typeof CUSTOMER_DETAIL_TAB_VALUES)[number];

const LEGACY_TAB_ALIASES: Record<string, CustomerDetailTab> = {
  info: "summary",
  consult: "consultation",
  tools: "consultation",
  contract: "contracts",
  timeline: "history",
  relationships: "history",
  referrals: "history",
  "claim-guidance": "history",
  "retention-risk": "history",
  assign_history: "history",
  consent: "history",
};

export function parseCustomerDetailTab(value: string | null): CustomerDetailTab {
  if (!value) return "summary";

  if (CUSTOMER_DETAIL_TAB_VALUES.includes(value as CustomerDetailTab)) {
    return value as CustomerDetailTab;
  }

  return LEGACY_TAB_ALIASES[value] ?? "summary";
}

export function getCustomerDetailTabFromLocation(
  location: string
): CustomerDetailTab {
  const query = location.split("?")[1]?.split("#")[0] ?? "";
  return parseCustomerDetailTab(new URLSearchParams(query).get("tab"));
}

export function buildCustomerDetailTabLocation(
  location: string,
  tab: CustomerDetailTab
): string {
  const hashIndex = location.indexOf("#");
  const hash = hashIndex >= 0 ? location.slice(hashIndex) : "";
  const locationWithoutHash =
    hashIndex >= 0 ? location.slice(0, hashIndex) : location;
  const [pathname, query = ""] = locationWithoutHash.split("?");
  const params = new URLSearchParams(query);
  params.set("tab", tab);
  const nextQuery = params.toString();

  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash}`;
}
