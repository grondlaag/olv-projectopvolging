import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"
import { useAppStore } from "../app/state/app-store"

if (typeof window !== "undefined") {
  Object.defineProperty(window, "scrollTo", {
    value: () => undefined,
    writable: true,
  })
}

afterEach(() => {
  cleanup()
  useAppStore.getState().reset()
  if (typeof window !== "undefined") window.location.hash = ""
})
