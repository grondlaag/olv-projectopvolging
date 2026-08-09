import { act, render, screen } from "@testing-library/react"
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
    expect(screen.getByText("Geen bestand geladen")).toBeInTheDocument()

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
