import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Local Vercel CLI metadata and ad-hoc scripts; ignored by Git as well.
    ".vercel/**",
    // Agent worktrees are full checkouts, build output included; each lints itself.
    ".claude/**",
    // Design-system build output and the staged design-sync converter scripts.
    "ds-dist/**",
    "ds-bundle/**",
    ".ds-sync/**",
  ]),
]);

export default eslintConfig;
