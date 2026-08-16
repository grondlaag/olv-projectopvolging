import { render, screen } from "@testing-library/react"
import { RouterProvider } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { createAppRouter } from "../app/routing"
import { useAppStore } from "../app/state/app-store"
import {
  createDataSessionSnapshot,
  restoreDataSession,
} from "../application/services"
import { createPortfolioTestSession } from "./test-data"

describe("dirty state en sessieherstel", () => {
  it("toont opslaan vereist en waarschuwt bij unload wanneer dirty", async () => {
    useAppStore.setState({
      session: createPortfolioTestSession(),
      loadedFileName: "portfolio-test.json",
      dirty: true,
    })
    window.location.hash = "#/dashboard"
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByText("Wijzigingen nog niet opgeslagen"),
    ).toBeInTheDocument()
    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    router.dispose()
  })

  it("herstelt normalized state en bestandsmetadata uit een snapshot", () => {
    const session = createPortfolioTestSession()
    const snapshot = createDataSessionSnapshot(
      session,
      true,
      "2026-01-15T12:00:00.000Z",
    )
    const restored = restoreDataSession(snapshot)

    expect(restored.fileName).toBe("portfolio-test.json")
    expect(restored.state.indices.projectById.size).toBe(3)
    expect(snapshot.dirty).toBe(true)
    expect(snapshot.lastSavedAt).toBe("2026-01-15T12:00:00.000Z")
  })

  it("markeert de sessie clean na opslaan", () => {
    useAppStore.setState({ dirty: true })
    useAppStore.getState().markSaved(undefined, "2026-01-15T12:00:00.000Z")

    expect(useAppStore.getState().dirty).toBe(false)
    expect(useAppStore.getState().lastSavedAt).toBe("2026-01-15T12:00:00.000Z")
  })
})
