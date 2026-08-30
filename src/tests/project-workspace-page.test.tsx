import { fireEvent, render, screen, within } from "@testing-library/react"
import { RouterProvider } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"
import { createAppRouter } from "../app/routing"
import { useAppStore } from "../app/state/app-store"
import { createPortfolioTestSession, testIds } from "./test-data"

describe("projectwerkruimte met vier afgeleide views", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.setState({
      session: createPortfolioTestSession(),
      loadedFileName: "portfolio-test.json",
    })
  })

  it("toont uitsluitend Dashboard, Journaal, Planning en Budget", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}`
    render(<RouterProvider router={createAppRouter()} />)

    const navigation = await screen.findByRole("navigation", {
      name: "Projectdossierweergave",
    })
    expect(
      within(navigation)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Dashboard", "Journaal1", "Planning", "Budget"])
    expect(screen.getByText("Actieve topics")).toBeInTheDocument()
    expect(screen.getByText("Aandacht nodig")).toBeInTheDocument()
  })

  it("voegt een actie inline toe en opent contextuele topiceigenschappen", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/journal`
    render(<RouterProvider router={createAppRouter()} />)

    const composer = await screen.findByLabelText(
      "Nieuwe bijdrage aan Toegang spoed",
    )
    fireEvent.click(
      within(composer.closest(".journal-composer") as HTMLElement).getByRole(
        "button",
        { name: "Actie" },
      ),
    )
    fireEvent.change(composer, {
      target: { value: "Controleer branddoorgang" },
    })
    fireEvent.keyDown(composer, { key: "Enter" })

    expect(
      await screen.findByText("Controleer branddoorgang"),
    ).toBeInTheDocument()
    expect(useAppStore.getState().dirty).toBe(true)

    fireEvent.click(
      screen.getByRole("button", { name: /Kritiek synthetisch topic/ }),
    )
    expect(
      screen.getByRole("complementary", { name: "Topiceigenschappen" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Beslissing vragen")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Topic sluiten" }),
    ).toBeInTheDocument()
  })

  it("maakt slashcommando's vindbaar tijdens typen", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/journal`
    render(<RouterProvider router={createAppRouter()} />)
    const composer = await screen.findByLabelText(
      "Nieuwe bijdrage aan Toegang spoed",
    )
    fireEvent.change(composer, { target: { value: "/a" } })
    expect(
      screen.getByRole("listbox", { name: "Journaalcommando's" }),
    ).toHaveTextContent("/actie")
    expect(
      screen.getByRole("listbox", { name: "Journaalcommando's" }),
    ).toHaveTextContent("/agendeer")
  })
})
