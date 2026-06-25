export type SmokeRole =
  | "branch_admin"
  | "sub_branch_admin"
  | "team_leader"
  | "member";

export type RoleRouteExpectation = {
  path: string;
  expectForbidden?: boolean;
  expectSensitiveUnavailable?: boolean;
  expectBlocked?: boolean;
  label?: string;
};

export const CORE_RESPONSIVE_ROUTES = [
  { path: "/", label: "Dashboard" },
  { path: "/customers", label: "CustomerList" },
  { path: "/customers/101", label: "CustomerDetail" },
  { path: "/customers/assign", label: "CustomerAssign" },
  { path: "/calendar", label: "Calendar" },
  { path: "/notifications", label: "Notifications" },
] as const;

export const ROLE_ROUTE_MATRIX: Record<SmokeRole, RoleRouteExpectation[]> = {
  branch_admin: [
    { path: "/" },
    { path: "/customers" },
    { path: "/customers/101" },
    { path: "/customers/assign" },
    { path: "/users" },
    { path: "/organization" },
    { path: "/users/handoff" },
    { path: "/customers/merge" },
    { path: "/deleted-data" },
    { path: "/logs" },
    { path: "/operation-risk" },
  ],
  sub_branch_admin: [
    { path: "/" },
    { path: "/customers" },
    { path: "/customers/assign" },
    { path: "/users", expectForbidden: true },
    { path: "/deleted-data", expectForbidden: true },
    { path: "/customers/merge", expectForbidden: true },
  ],
  team_leader: [
    { path: "/" },
    { path: "/customers" },
    { path: "/customers/assign" },
    { path: "/logs" },
    { path: "/users/handoff", expectForbidden: true },
    { path: "/customers/merge", expectForbidden: true },
  ],
  member: [
    { path: "/" },
    { path: "/customers" },
    { path: "/customers/101" },
    { path: "/calendar" },
    { path: "/notifications" },
    { path: "/users", expectForbidden: true },
    { path: "/deleted-data", expectForbidden: true },
  ],
};

export const INACTIVE_ROUTE_CHECKS: RoleRouteExpectation[] = [
  { path: "/", expectBlocked: true },
  { path: "/customers", expectBlocked: true },
  { path: "/users", expectBlocked: true },
];
