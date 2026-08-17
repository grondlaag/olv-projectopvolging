import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { RouterProvider } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"
import { createAppRouter } from "../app/routing"
import { useAppStore } from "../app/state/app-store"
import { BudgetManagementService } from "../application/services"
import type { LocalDate, UUID } from "../domain"
import { createPortfolioTestSession, testIds } from "./test-data"

const service = new BudgetManagementService()

describe("budgetwerkruimte", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.setState({
      session: createPortfolioTestSession(),
      loadedFileName: "portfolio-test.json",
    })
  })

  it("voegt een topicgekoppeld budgetitem toe met vaste projectcontext", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/budget`
    const router = createAppRouter()
    const view = render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole(
        "heading",
        { name: "Renovatie verpleegafdeling" },
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "+ Budgetitem" }))
    const panel = screen.getByRole("dialog", { name: "Budgetitem toevoegen" })
    expect(
      within(panel).getByText(/projectcontext staat vast/),
    ).toHaveTextContent("PRJ-001")
    fireEvent.change(within(panel).getByLabelText("Type"), {
      target: { value: "Meerwerk" },
    })
    fireEvent.change(within(panel).getByLabelText("Status"), {
      target: { value: "Vastgelegd" },
    })
    fireEvent.change(within(panel).getByLabelText("Categorie"), {
      target: { value: "Fasering" },
    })
    fireEvent.change(within(panel).getByLabelText("Bedrag"), {
      target: { value: "1.250,50" },
    })
    fireEvent.change(within(panel).getByLabelText("Datum"), {
      target: { value: "2026-03-01" },
    })
    fireEvent.change(within(panel).getByLabelText("Omschrijving"), {
      target: { value: "Nachtwerk voor zorgcontinuïteit" },
    })
    fireEvent.change(within(panel).getByLabelText("Topic"), {
      target: { value: testIds.topicCritical },
    })
    fireEvent.click(
      within(panel).getByRole("button", { name: "Budgetitem opslaan" }),
    )

    await waitFor(() =>
      expect(
        useAppStore.getState().session!.state.records.budgets,
      ).toHaveLength(1),
    )
    expect(useAppStore.getState().dirty).toBe(true)
    expect(
      useAppStore.getState().session!.state.records.budgets[0],
    ).toMatchObject({
      projectId: testIds.projectOne,
      topicId: testIds.topicCritical,
      amountCents: 125_050,
      type: "Meerwerk",
    })
    expect(
      await screen.findByText(
        "Budgetitem opgeslagen in de lokale sessie · back-up nodig",
      ),
    ).toBeInTheDocument()
    view.unmount()
    router.dispose()
  })

  it("corrigeert een bedrag en toont de append-only historie", async () => {
    const session = createPortfolioTestSession()
    const created = service.createRecord(
      session.state,
      {
        projectId: testIds.projectOne,
        category: "Werken",
        type: "Factuur",
        description: "Factuur aannemer",
        amountCents: 120_000,
        date: "2026-03-01" as LocalDate,
        status: "Gefactureerd",
      },
      {
        createUuid: () => "d0000000-0000-4000-8000-000000000001" as UUID,
      },
    )
    useAppStore.setState({ session: { ...session, state: created.state } })
    window.location.hash = `#/projects/${testIds.projectOne}/budget`
    const router = createAppRouter()
    const view = render(<RouterProvider router={router} />)

    await screen.findByRole(
      "heading",
      { name: "Renovatie verpleegafdeling" },
      { timeout: 15_000 },
    )
    fireEvent.click(screen.getByRole("button", { name: "Corrigeren" }))
    let panel = screen.getByRole("dialog", { name: "Bedrag corrigeren" })
    fireEvent.change(within(panel).getByLabelText("Nieuw bedrag"), {
      target: { value: "1.020,00" },
    })
    fireEvent.change(within(panel).getByLabelText("Reden"), {
      target: { value: "Twee cijfers waren omgewisseld." },
    })
    fireEvent.click(
      within(panel).getByRole("button", { name: "Correctie opslaan" }),
    )

    await waitFor(() =>
      expect(
        useAppStore.getState().session!.state.records.budgetMutations,
      ).toHaveLength(1),
    )
    fireEvent.click(screen.getByRole("button", { name: "Corrigeren (1)" }))
    panel = screen.getByRole("dialog", { name: "Bedrag corrigeren" })
    expect(
      within(panel).getByText("Twee cijfers waren omgewisseld."),
    ).toBeVisible()
    expect(within(panel).getByText(/€\s?1\.200,00/)).toBeVisible()
    expect(within(panel).getAllByText(/€\s?1\.020,00/)).toHaveLength(2)
    view.unmount()
    router.dispose()
  })

  it("opent de globale budgetpagina met projectfilter en groepering", async () => {
    const session = createPortfolioTestSession()
    const created = service.createRecord(session.state, {
      projectId: testIds.projectOne,
      category: "Werken",
      type: "Raming",
      description: "Globale analyse",
      amountCents: 500_000,
      date: "2026-03-01" as LocalDate,
      status: "Verwacht",
    })
    useAppStore.setState({ session: { ...session, state: created.state } })
    window.location.hash = "#/budget"
    const router = createAppRouter()
    const view = render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole(
        "heading",
        { name: "Budget" },
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByText("Filters", { exact: true }))
    fireEvent.change(screen.getByLabelText("Projectfilter"), {
      target: { value: testIds.projectOne },
    })
    expect(window.location.hash).toContain(`project=${testIds.projectOne}`)
    fireEvent.click(screen.getByText(/H1 · Gebouw en ruimte/))
    fireEvent.click(
      screen
        .getAllByText("Zorgcampus", { exact: true })
        .find((element) => element.closest("summary"))!,
    )
    expect(screen.getByRole("cell", { name: /PRJ-001/ })).toBeVisible()
    fireEvent.click(screen.getByText("Andere groepering"))
    fireEvent.change(screen.getByLabelText("Groepeer per"), {
      target: { value: "project" },
    })
    expect(window.location.hash).toContain("groepering=project")
    expect(
      screen.queryByText("Regel vereist", { exact: true }),
    ).not.toBeInTheDocument()
    view.unmount()
    router.dispose()
  })
})
