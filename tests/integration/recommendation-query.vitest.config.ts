import base from "../../vitest.config";
export default {
  ...base,
  test: {
    ...base.test,
    include: ["tests/integration/recommendation-query.mysql.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
};
