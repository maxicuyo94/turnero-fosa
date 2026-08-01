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
    // Design-system build output and the staged design-sync converter scripts.
    "ds-dist/**",
    "ds-bundle/**",
    ".ds-sync/**",
  ]),
]);

export default eslintConfig;
