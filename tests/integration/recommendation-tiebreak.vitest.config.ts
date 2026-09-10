import base from "../../vitest.config";
export default {
  ...base,
  test: {
    ...base.test,
    include: ["tests/integration/recommendation-tiebreak.mysql.test.ts"],
    testTimeout: 120000,
    hookTimeout: 120000,
  },
};
