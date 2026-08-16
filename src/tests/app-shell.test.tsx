import { act, fireEvent, render, screen } from "@testing-library/react"
import { RouterProvider } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { createAppRouter } from "../app/routing"

describe("hashrouting en applicatieshell", () => {
  it("opent de portfolio-hashroute binnen de applicatieshell", async () => {
    window.location.hash = "#/portfolio"
    const router = createAppRouter()

    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Portfolio" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("navigation", { name: "Hoofdnavigatie" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Geen gegevensbestand geopend")).toBeInTheDocument()

    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    expect(screen.getByText("Snel maken")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Nieuw project/ }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "+ Nieuw" }))
    expect(
      screen.getByRole("menuitem", { name: /Nieuw overlegmoment/ }),
    ).toBeInTheDocument()

    await act(async () => {
      await router.navigate("/dashboard")
    })
    expect(
      await screen.findByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument()
    expect(window.location.hash).toBe("#/dashboard")

    router.dispose()
  })
})
