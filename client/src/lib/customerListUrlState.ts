import {
  CUSTOMER_SEGMENTS,
  type CustomerSegment,
} from "@shared/customerSegment";
import { CONSULT_STATUSES } from "@shared/salesPipeline";

export const CUSTOMER_LIST_VIEWS = ["card", "table"] as const;
export type CustomerListView = (typeof CUSTOMER_LIST_VIEWS)[number];

export const CUSTOMER_LIST_SORTS = [
  "recent",
  "name",
  "next_contact",
  "contract_value",
] as const;
export type CustomerListSort = (typeof CUSTOMER_LIST_SORTS)[number];

export const CUSTOMER_LIST_PAGE_SIZES = [20, 50, 100] as const;

export const CUSTOMER_LIST_TAGS = [
  "가격민감형",
  "보장불안형",
  "가족책임형",
  "무관심형",
  "해지위험",
  "리밸런싱필요",
  "사후관리필요",
  "소개가능성",
  "고액계약가능성",
  "장기관리",
] as const;

export const CUSTOMER_LIST_NEXT_ACTIONS = [
  "재연락",
  "설계안 발송",
  "보장분석 진행",
  "계약 진행",
  "추가 자료 요청",
  "가족과 상의",
  "보류",
  "거절",
  "장기관리",
  "사후관리",
] as const;

const CUSTOMER_LIST_PRIORITIES = ["A", "B", "C", "D", "unclassified"] as const;

export type CustomerListUrlState = {
  segment: CustomerSegment;
  search: string;
  status: string;
  priority: string;
  agent: string;
  tag: string;
  nextAction: string;
  region: string;
  source: string;
  assignedDateFrom: string;
  assignedDateTo: string;
  scope: "all" | "mine";
  sort: CustomerListSort;
  page: number;
  pageSize: number;
  view: CustomerListView;
};

const LEGACY_SEGMENTS: Record<string, CustomerSegment> = {
  db_only: "database",
  in_progress_db: "database",
};

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function allowedValue<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T | "all" = "all"
) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizedText(value: string | null, maxLength = 100) {
  return (value ?? "").trim().slice(0, maxLength);
}

function normalizedDate(value: string | null) {
  const normalized = normalizedText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "";
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === normalized
    ? normalized
    : "";
}

function normalizedAgent(value: string | null) {
  if (value === "unassigned") return value;
  return positiveInteger(value, 0) > 0 ? String(Number(value)) : "all";
}

export function normalizeCustomerSearch(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
}

export function parseCustomerListUrlState(
  query: string,
  options: { isMobile?: boolean; defaultSegment?: CustomerSegment } = {}
): CustomerListUrlState {
  const params = new URLSearchParams(query.replace(/^\?/, ""));
  const rawSegment = params.get("segment") ?? "";
  const segment = CUSTOMER_SEGMENTS.includes(rawSegment as CustomerSegment)
    ? (rawSegment as CustomerSegment)
    : (LEGACY_SEGMENTS[rawSegment] ?? options.defaultSegment ?? "all");
  const rawView = params.get("view");
  const view =
    !options.isMobile && CUSTOMER_LIST_VIEWS.includes(rawView as CustomerListView)
      ? (rawView as CustomerListView)
      : "card";
  const rawSort = params.get("sort");
  const sort = CUSTOMER_LIST_SORTS.includes(rawSort as CustomerListSort)
    ? (rawSort as CustomerListSort)
    : "recent";
  const requestedPageSize = positiveInteger(params.get("pageSize"), 20);
  const pageSize = CUSTOMER_LIST_PAGE_SIZES.includes(
    requestedPageSize as (typeof CUSTOMER_LIST_PAGE_SIZES)[number]
  )
    ? requestedPageSize
    : 20;

  return {
    segment,
    search: normalizeCustomerSearch(params.get("search")),
    status: allowedValue(params.get("status"), CONSULT_STATUSES),
    priority: allowedValue(params.get("priority"), CUSTOMER_LIST_PRIORITIES),
    agent: normalizedAgent(params.get("agent")),
    tag: allowedValue(params.get("tag"), CUSTOMER_LIST_TAGS),
    nextAction: allowedValue(
      params.get("nextAction"),
      CUSTOMER_LIST_NEXT_ACTIONS
    ),
    region: normalizedText(params.get("region")),
    source: normalizedText(params.get("source")),
    assignedDateFrom: normalizedDate(params.get("assignedFrom")),
    assignedDateTo: normalizedDate(params.get("assignedTo")),
    scope: params.get("scope") === "mine" ? "mine" : "all",
    sort,
    page: positiveInteger(params.get("page"), 1),
    pageSize,
    view,
  };
}

export function writeCustomerListUrlState(
  query: string,
  state: CustomerListUrlState
) {
  const params = new URLSearchParams(query.replace(/^\?/, ""));
  const setOptional = (key: string, value: string, defaultValue = "") => {
    if (value && value !== defaultValue) params.set(key, value);
    else params.delete(key);
  };

  setOptional("segment", state.segment, "all");
  setOptional("search", normalizeCustomerSearch(state.search));
  setOptional("status", state.status, "all");
  setOptional("priority", state.priority, "all");
  setOptional("agent", state.agent, "all");
  setOptional("tag", state.tag, "all");
  setOptional("nextAction", state.nextAction, "all");
  setOptional("region", state.region);
  setOptional("source", state.source);
  setOptional("assignedFrom", state.assignedDateFrom);
  setOptional("assignedTo", state.assignedDateTo);
  setOptional("scope", state.scope, "all");
  setOptional("sort", state.sort, "recent");
  setOptional("view", state.view, "card");
  if (state.page > 1) params.set("page", String(state.page));
  else params.delete("page");
  if (state.pageSize !== 20) params.set("pageSize", String(state.pageSize));
  else params.delete("pageSize");
  return params.toString();
}
