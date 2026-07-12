import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/src/**/*.test.tsx",
      "shared/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "quality-results/coverage",
      reporter: ["text-summary", "json-summary", "json", "lcov", "html"],
      include: [
        "server/**/*.ts",
        "client/src/**/*.{ts,tsx}",
        "shared/**/*.ts",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/*.d.ts",
        "client/src/main.tsx",
        "server/_core/index.ts",
      ],
      thresholds: {
        statements: 33.7,
        branches: 70,
        functions: 47.5,
        lines: 33.7,
      },
    },
  },
});
