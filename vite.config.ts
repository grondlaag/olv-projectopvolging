import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    fileParallelism: false,
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: "./src/tests/setup.ts",
    testTimeout: 15_000,
  },
})
