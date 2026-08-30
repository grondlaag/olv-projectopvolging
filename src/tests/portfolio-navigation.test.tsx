import { fireEvent, render, screen } from "@testing-library/react"
import { RouterProvider } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"
import { createAppRouter } from "../app/routing"
import { useAppStore } from "../app/state/app-store"
import { createPortfolioTestSession, testIds } from "./test-data"

describe("portfolio- en projectnavigatie", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.setState({ session: createPortfolioTestSession() })
  })

  it("opent een project met één klik op de typed projectregel", async () => {
    window.location.hash = "#/portfolio?weergave=all"
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    fireEvent.click(
      await screen.findByRole("button", {
        name: "PRJ-001 Renovatie verpleegafdeling openen",
      }),
    )

    expect(window.location.hash).toBe(`#/projects/${testIds.projectOne}`)
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Renovatie verpleegafdeling",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("Actieve topics")).toBeInTheDocument()
    router.dispose()
  })

  it("opent een geldige project-hashroute rechtstreeks", async () => {
    window.location.hash = `#/projects/${testIds.projectThree}`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Beleidsproject energie",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("Actieve topics")).toBeInTheDocument()
    router.dispose()
  })
})
