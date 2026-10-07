import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const databaseTests = "tests/**/*-prisma.test.ts";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/**/*.{test,spec}.{ts,tsx}"], exclude: [databaseTests] } },
      // Database files share one PostgreSQL database and its single workshop settings row, rewriting
      // settings and deleting their fixtures; run in parallel they break each other's assertions.
      { extends: true, test: { name: "database", include: [databaseTests], fileParallelism: false } },
    ],
  },
});
