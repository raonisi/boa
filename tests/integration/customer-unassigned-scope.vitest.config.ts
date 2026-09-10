import base from "../../vitest.config";

// Explicit opt-in integration command; ordinary unit tests never connect to MySQL.
export default {
  ...base,
  test: {
    ...base.test,
    include: ["tests/integration/customer-unassigned-scope.mysql.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
};
