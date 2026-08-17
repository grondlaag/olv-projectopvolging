import { defineConfig } from "@playwright/test"

const usesExternalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === "true"
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Keep the release suite deterministic on resource-constrained Windows runners.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  ...(usesExternalServer
    ? {}
    : {
        webServer: {
          command: "npm run build && npm run preview -- --host 127.0.0.1",
          url: "http://127.0.0.1:4173",
          timeout: 180_000,
          reuseExistingServer: !process.env.CI,
        },
      }),
})
