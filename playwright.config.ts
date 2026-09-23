import { defineConfig, devices } from "@playwright/test";
import { playwrightBaseUrl, playwrightPort } from "./e2e/helpers/base-url";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: 1,
  // Compila las rutas antes de la suite: en desarrollo la primera visita tarda segundos.
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: playwrightBaseUrl,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm dev --port ${playwrightPort}`,
    url: playwrightBaseUrl,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
