import type { Page } from "@playwright/test";
import SuperJSON from "superjson";
import { mockBoaTrpc } from "./mock-trpc";

export const FIXED_NOW = "2026-09-08T09:00:00.000Z";
// 123 independent IDs: larger supported page size 50 still has three pages.
export const countCustomers = Array.from({ length: 123 }, (_, i) => ({
  id: 93001 + i,
  name: `[TEST] 고객${String(i + 1).padStart(3, "0")}`,
  phone: "010-0000-0000",
  agentId: i < 63 ? 1 : 4,
  assignedTeamId: i < 63 ? null : 10,
  subBranchAdminId: i < 63 ? null : 2,
  isActive: true,
  assignmentStatus: "assigned_to_member",
  consultStatus: i < 83 ? "미상담" : "통화완료",
  nextAction: i < 73 ? null : "재연락",
  priority: i < 50 ? "A" : "C",
  region: i < 90 ? "서울" : "부산",
  source: "합성",
  assignedAt:
    i < 43
      ? "2026-08-01T00:00:00.000Z"
      : i < 76
        ? "2026-09-07T23:00:00.000Z"
        : null,
  createdAt: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
  customerSegment: i < 103 ? "database" : "contracted",
  contractCount: i < 103 ? 0 : 2,
  monthlyPremiumTotal: i < 103 ? 0 : (123 - i) * 10000,
  nextFollowUpAt: new Date(Date.UTC(2026, 9, 1, i)).toISOString(),
}));
export const expectedQuick = {
  all: 123,
  today_contact: 50,
  urgent: 13,
  uncontacted: 83,
  sla_overdue: 43,
  no_next_action: 73,
  mine: 63,
  new_db: 33,
};
export const countSuccess = (data: unknown) => ({
  result: { data: SuperJSON.serialize(data) },
});
export const countFailure = (code = "INTERNAL_SERVER_ERROR") => ({
  error: SuperJSON.serialize({
    message: "Synthetic query failure",
    code: code === "FORBIDDEN" ? -32003 : -32603,
    data: { code, httpStatus: code === "FORBIDDEN" ? 403 : 500 },
  }),
});

export async function setupCountFixture(page: Page) {
  const state = {
    fail: false,
    zero: false,
    created: false,
    role: "branch_admin",
    actor: 1,
    version: 0,
    delaySearch: "",
    delayMs: 0,
    requests: [] as Array<{ procedure: string; input: any }>,
    mutations: [] as string[],
  };
  await page.clock.setFixedTime(new Date(FIXED_NOW));
  await page.route("**/*", route =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort()
  );
  page.on("request", req => {
    if (req.method() === "POST" && req.url().includes("/api/trpc/"))
      state.mutations.push(req.url());
  });
  await mockBoaTrpc(page, "branch_admin", {
    async transformResponse(procedure, original, input = {}) {
      state.requests.push({ procedure, input });
      if (procedure === "customers.create") {
        state.created = true;
        return countSuccess({ id: 94000 });
      }
      if (procedure === "auth.me") {
        const user = SuperJSON.deserialize(
          (original as any).result.data
        ) as any;
        return countSuccess({
          ...user,
          id: state.actor,
          role: state.role,
          teamId: state.actor === 1 ? null : 10,
          sessionInvalidatedAt: state.version,
        });
      }
      if (procedure === "recommendations.priorityContacts")
        return countSuccess(
          countCustomers
            .slice(0, 50)
            .map((c, i) => ({
              customerId: c.id,
              totalScore: 100 - i,
              urgency: i < 13 ? "high" : "medium",
              warnings: [],
              reasons: [],
            }))
        );
      if (
        ![
          "customers.list",
          "customers.segmentCounts",
          "customers.quickCounts",
        ].includes(procedure)
      )
        return original;
      const fail = state.fail;
      const dataset = [
        ...countCustomers,
        ...(state.created
          ? [
              {
                ...countCustomers[0],
                id: 94000,
                name: "[TEST] 신규",
                assignedAt: null,
              },
            ]
          : []),
      ];
      const rows = state.zero
        ? []
        : dataset.filter(c => state.actor === 1 || c.agentId === state.actor);
      if (state.delaySearch && input.search === state.delaySearch)
        await new Promise(resolve => setTimeout(resolve, state.delayMs));
      if (fail) return countFailure();
      const segmentRows = (values: typeof rows, segment: string) =>
        values.filter(
          c => !segment || segment === "all" || c.customerSegment === segment
        );
      if (procedure === "customers.quickCounts") {
        const subset = segmentRows(rows, input.segment);
        return countSuccess({
          all: subset.length,
          mine: subset.filter(c => c.agentId === state.actor).length,
          today_contact: input.recommendationIds
            ? subset.filter(c => input.recommendationIds.includes(c.id)).length
            : null,
          urgent: input.urgentIds
            ? subset.filter(c => input.urgentIds.includes(c.id)).length
            : null,
          uncontacted: subset.filter(c => c.consultStatus === "미상담").length,
          sla_overdue: subset.filter(c => c.id <= 93043).length,
          no_next_action: subset.filter(c => c.nextAction === null).length,
          new_db: subset.filter(c => c.id >= 93044 && c.id <= 93076).length,
        });
      }
      let result = rows.filter(
        c =>
          (!input.search || c.name.includes(input.search)) &&
          (!input.status || c.consultStatus === input.status) &&
          (!input.priority || c.priority === input.priority) &&
          (!input.region || c.region === input.region) &&
          (input.scope !== "mine" || c.agentId === state.actor) &&
          (!input.agentIdFilter || c.agentId === input.agentIdFilter) &&
          (!input.customerIds || input.customerIds.includes(c.id)) &&
          (!input.assignedDateFrom ||
            Boolean(c.assignedAt && c.assignedAt >= input.assignedDateFrom)) &&
          (!input.assignedDateTo ||
            Boolean(
              c.assignedAt &&
                c.assignedAt <= input.assignedDateTo + "T00:00:00.000Z"
            )) &&
          (input.workflowFilter !== "uncontacted" ||
            c.consultStatus === "미상담") &&
          (input.workflowFilter !== "sla_overdue" || c.id <= 93043) &&
          (input.workflowFilter !== "no_next_action" || c.nextAction === null)
      );
      if (procedure === "customers.segmentCounts")
        return countSuccess({
          all: result.length,
          database: result.filter(c => c.customerSegment === "database").length,
          contracted: result.filter(c => c.customerSegment === "contracted")
            .length,
        });
      result = segmentRows(result, input.segment);
      result.sort((a, b) =>
        input.sort === "name"
          ? a.name.localeCompare(b.name)
          : input.sort === "next_contact"
            ? a.nextFollowUpAt.localeCompare(b.nextFollowUpAt)
            : input.sort === "contract_value"
              ? b.monthlyPremiumTotal - a.monthlyPremiumTotal ||
                b.createdAt.localeCompare(a.createdAt)
              : b.createdAt.localeCompare(a.createdAt)
      );
      if (input.pageSize)
        result = result.slice(
          ((input.page ?? 1) - 1) * input.pageSize,
          (input.page ?? 1) * input.pageSize
        );
      return countSuccess(result);
    },
  });
  return state;
}
