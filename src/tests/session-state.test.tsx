import { render, screen } from "@testing-library/react"
import { RouterProvider } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { createAppRouter } from "../app/routing"
import { useAppStore } from "../app/state/app-store"
import {
  createWorkbookSessionSnapshot,
  restoreWorkbookSession,
} from "../application/services"
import { createPortfolioTestSession } from "./test-data"

describe("dirty state en sessieherstel", () => {
  it("toont export vereist en waarschuwt bij unload wanneer dirty", async () => {
    useAppStore.setState({
      session: createPortfolioTestSession(),
      loadedFileName: "portfolio-test.xlsx",
      dirty: true,
    })
    window.location.hash = "#/dashboard"
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByText("Wijzigingen nog niet geëxporteerd"),
    ).toBeInTheDocument()
    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    router.dispose()
  })

  it("herstelt normalized state en bestandsmetadata uit een snapshot", () => {
    const session = createPortfolioTestSession()
    const snapshot = createWorkbookSessionSnapshot(
      session,
      true,
      "2026-01-15T12:00:00.000Z",
    )
    const restored = restoreWorkbookSession(snapshot)

    expect(restored.fileName).toBe("portfolio-test.xlsx")
    expect(restored.state.indices.projectById.size).toBe(3)
    expect(snapshot.dirty).toBe(true)
    expect(snapshot.lastExportAt).toBe("2026-01-15T12:00:00.000Z")
  })

  it("markeert de sessie clean na een export", () => {
    useAppStore.setState({ dirty: true })
    useAppStore.getState().markExported("2026-01-15T12:00:00.000Z")

    expect(useAppStore.getState().dirty).toBe(false)
    expect(useAppStore.getState().lastExportAt).toBe("2026-01-15T12:00:00.000Z")
  })
})
