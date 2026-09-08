import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __PKG_NAME__: JSON.stringify("wiki-entity"),
    __PKG_VERSION__: JSON.stringify("0.0.0-test"),
    __PKG_HOMEPAGE__: JSON.stringify("https://github.com/entitizer/wiki-entity")
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
          environment: "node"
        }
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          environment: "node",
          testTimeout: 60_000,
          hookTimeout: 60_000,
          retry: 2,
          // Live APIs are rate limited: never hammer them in parallel.
          fileParallelism: false
        }
      }
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/globals.d.ts"],
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90
      }
    }
  }
});
