import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
    exclude: ["**/dist/**", "**/node_modules/**"],
    testTimeout: 30000, // Increased timeout for E2E tests
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "**/*.test.ts",
        "**/*.config.ts",
        "**/dist/**",
        "**/node_modules/**",
        "**/e2e/**", // Exclude E2E tests from coverage for now
      ],
    },
    // Setup global test environment
    setupFiles: [],
  },
});
