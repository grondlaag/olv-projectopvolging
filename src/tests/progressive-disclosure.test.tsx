import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  Composer,
  FilterPanel,
  KpiStrip,
  OverflowMenu,
  SidePanel,
  ViewBar,
  WorkspaceGrid,
  WorkspacePage,
} from "../design-system/components"

describe("progressive disclosure componenten", () => {
  it("houdt filters compact en laat actieve filters rechtstreeks verwijderen", () => {
    const remove = vi.fn()
    render(
      <FilterPanel
        activeFilters={[
          { id: "status", label: "Status: Open", onRemove: remove },
        ]}
      >
        <label>
          <span>Status</span>
          <select aria-label="Statusfilter">
            <option>Open</option>
          </select>
        </label>
      </FilterPanel>,
    )

    expect(screen.getByText("1 actief")).toBeVisible()
    expect(screen.queryByLabelText("Statusfilter")).not.toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: /Status: Open/ }))
    expect(remove).toHaveBeenCalledOnce()
  })

  it("toont kerncijfers als een semantische strook", () => {
    render(
      <KpiStrip
        items={[
          { id: "budget", label: "Budget", value: "€ 10.000,00" },
          { id: "raming", label: "Raming", value: "—" },
        ]}
      />,
    )

    expect(screen.getByText("Budget")).toBeVisible()
    expect(screen.getByText("€ 10.000,00")).toBeVisible()
  })

  it("opent composer, zijpaneel en overflowmenu zonder domeinmutatie", () => {
    const selectTab = vi.fn()
    const togglePanel = vi.fn()
    render(
      <>
        <Composer
          title="Vastleggen"
          context="TOP-001"
          tabs={[
            { id: "update", label: "Update" },
            { id: "action", label: "Actie" },
          ]}
          activeTab="update"
          onTabChange={selectTab}
        >
          <textarea aria-label="Bijdrage" />
        </Composer>
        <SidePanel title="Context" open={false} onOpenChange={togglePanel}>
          <p>Contextinhoud</p>
        </SidePanel>
        <OverflowMenu>
          <button type="button">Bewerken</button>
        </OverflowMenu>
      </>,
    )

    expect(screen.queryByLabelText("Bijdrage")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "+ Update toevoegen" }))
    expect(screen.getByLabelText("Bijdrage")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Actie" }))
    expect(selectTab).toHaveBeenCalledWith("action")

    fireEvent.click(screen.getByRole("button", { name: "Openen" }))
    expect(togglePanel).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByRole("button", { name: "Meer acties" }))
    expect(screen.getByRole("button", { name: "Bewerken" })).toBeVisible()
  })

  it("bouwt elke pagina op uit dezelfde werkruimte-regio's", () => {
    render(
      <WorkspacePage data-testid="workspace">
        <ViewBar
          primary={<strong>Portefeuille</strong>}
          actions={<button type="button">Nieuwe weergave</button>}
        >
          <span>2 filters actief</span>
        </ViewBar>
        <WorkspaceGrid
          navigation={<nav aria-label="Lokale navigatie">Hoofdstukken</nav>}
          inspector={<section aria-label="Inspector">Details</section>}
        >
          <main>Resultaten</main>
        </WorkspaceGrid>
      </WorkspacePage>,
    )

    expect(screen.getByTestId("workspace")).toHaveClass("workspace-page")
    expect(
      screen.getByRole("region", { name: "Weergave en filters" }),
    ).toBeVisible()
    expect(
      screen.getByRole("navigation", { name: "Lokale navigatie" }),
    ).toBeVisible()
    expect(screen.getByRole("region", { name: "Inspector" })).toBeVisible()
    expect(screen.getByRole("main")).toHaveTextContent("Resultaten")
  })
})
