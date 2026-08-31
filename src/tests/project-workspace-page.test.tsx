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
    const shell = composer.closest(".journal-composer") as HTMLElement
    fireEvent.click(
      within(shell).getByRole("button", { name: "Soort bijdrage" }),
    )
    fireEvent.click(within(shell).getByRole("menuitem", { name: "Actie" }))
    fireEvent.change(composer, {
      target: { value: "Controleer branddoorgang" },
    })
    fireEvent.keyDown(composer, { key: "Enter" })

    expect(
      await screen.findByText("Controleer branddoorgang"),
    ).toBeInTheDocument()
    expect(useAppStore.getState().dirty).toBe(true)

    fireEvent.click(
      screen.getByRole("button", { name: /T-001.*Toegang spoed/ }),
    )
    expect(
      screen.getByRole("complementary", { name: "Topiceigenschappen" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Beslissing nodig" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("Open")
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

  it("kiest actieve actoren voor vermeldingen en biedt Markdown-opmaak en voorbeeld", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/journal`
    render(<RouterProvider router={createAppRouter()} />)
    const composer = await screen.findByLabelText(
      "Nieuwe bijdrage aan Toegang spoed",
    )
    const shell = composer.closest(".journal-composer") as HTMLElement

    fireEvent.click(
      within(shell).getByRole("button", { name: "Persoon vermelden" }),
    )
    const actors = within(shell).getByRole("listbox", {
      name: "Actoren vermelden",
    })
    fireEvent.click(within(actors).getByRole("button", { name: /Anna/ }))
    fireEvent.click(
      within(shell).getByRole("button", { name: "Tag toevoegen" }),
    )
    fireEvent.click(
      within(shell).getByRole("button", { name: "Bijlagelink toevoegen" }),
    )

    expect(composer).toHaveValue("@Anna Coördinator # [bijlage](https://)")

    fireEvent.change(composer, { target: { value: "**Belangrijk**" } })
    fireEvent.click(within(shell).getByRole("button", { name: "Voorbeeld" }))
    expect(within(shell).getByLabelText("Markdownvoorbeeld")).toHaveTextContent(
      "Belangrijk",
    )
  })
})
