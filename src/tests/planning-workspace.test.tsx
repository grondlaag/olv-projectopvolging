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
import { PlanningManagementService } from "../application/services"
import type { LocalDate, UUID } from "../domain"
import { createPortfolioTestSession, testIds } from "./test-data"

const service = new PlanningManagementService()
let sequence = 0
const createUuid = () =>
  `e6000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}` as UUID

function sessionWithDependency() {
  const session = createPortfolioTestSession()
  const timing = service.saveTopicTiming(
    session.state,
    testIds.topicCritical,
    {
      startDate: "2026-01-16" as LocalDate,
      plannedEndDate: "2026-01-25" as LocalDate,
      progressPercent: 30,
      status: "Op schema",
      isMilestone: false,
    },
    { createUuid },
  )
  const milestone = timing.state.records.planning.find(
    (entry) => entry.kind === "Milestone",
  )!
  const dependency = service.createDependency(
    timing.state,
    {
      predecessorPlanningId: timing.record.id,
      successorPlanningId: milestone.id,
    },
    { createUuid },
  )
  return { ...session, state: dependency.state }
}

describe("planningwerkruimte", () => {
  beforeEach(() => {
    sequence = 0
    useAppStore.getState().reset()
    useAppStore.setState({
      session: sessionWithDependency(),
      loadedFileName: "portfolio-test.json",
    })
  })

  it("toont project-Gantt, wisselt zoom en weigert een cyclische afhankelijkheid", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/planning`
    const router = createAppRouter()
    const view = render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole(
        "heading",
        { name: "Renovatie verpleegafdeling" },
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole("navigation", { name: "Projectdossierweergave" }),
      ).getByRole("link", { name: "Planning" }),
    ).toHaveAttribute("aria-current", "page")
    expect(screen.getAllByText("Toegang spoed").length).toBeGreaterThan(0)
    expect(
      screen.getByRole("button", {
        name: /Synthetische mijlpaal, mijlpaal op/,
      }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Jaar"))
    expect(screen.getByLabelText("Jaar")).toBeChecked()

    fireEvent.click(screen.getByRole("button", { name: "+ Afhankelijkheid" }))
    const panel = screen.getByRole("dialog", {
      name: "Afhankelijkheid toevoegen",
    })
    const timing = useAppStore
      .getState()
      .session!.state.indices.planningByTopic.get(testIds.topicCritical)![0]!
    const milestone = useAppStore
      .getState()
      .session!.state.records.planning.find(
        (entry) => entry.kind === "Milestone",
      )!
    fireEvent.change(within(panel).getByLabelText("Voorganger"), {
      target: { value: milestone.id },
    })
    fireEvent.change(within(panel).getByLabelText("Opvolger"), {
      target: { value: timing.id },
    })
    fireEvent.click(
      within(panel).getByRole("button", {
        name: "Afhankelijkheid opslaan",
      }),
    )

    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "Deze afhankelijkheid zou een cyclus",
    )
    expect(
      useAppStore.getState().session?.state.records.planningDependencies,
    ).toHaveLength(1)
    view.unmount()
    router.dispose()
  })

  it("toont de portfoliohiërarchie met Zonder cluster en details ingeklapt", async () => {
    window.location.hash = "#/planning"
    const router = createAppRouter()
    const view = render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole(
        "heading",
        { name: "Portfolio-Gantt" },
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("Zonder cluster")).toBeInTheDocument()
    const summary = screen.getByRole("region", {
      name: "Samenvatting portfolioplanning",
    })
    expect(summary).toHaveTextContent("3/3")
    expect(
      within(summary).getByText("Planning").parentElement,
    ).toHaveTextContent("2 items")
    const projectToggle = screen.getByRole("button", {
      name: "Details tonen voor Renovatie verpleegafdeling",
    })
    expect(projectToggle).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(projectToggle)
    await waitFor(() =>
      expect(projectToggle).toHaveAttribute("aria-expanded", "true"),
    )
    expect(screen.getByText("Toegang spoed")).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Zichtbare lagen" }),
    ).not.toBeInTheDocument()

    const hashBeforeSelection = window.location.hash
    const projectRecordButton = screen
      .getAllByRole("button", { name: /Renovatie verpleegafdeling/ })
      .find((button) =>
        button.classList.contains("planning-gantt__record-link"),
      )!
    fireEvent.click(projectRecordButton)
    expect(
      screen.getByRole("dialog", { name: "Renovatie verpleegafdeling" }),
    ).toBeInTheDocument()
    expect(window.location.hash).toBe(hashBeforeSelection)
    fireEvent.click(screen.getByRole("button", { name: "Sluiten" }))

    fireEvent.click(
      screen.getAllByRole("button", { name: /Toegang spoed/ })[0]!,
    )
    expect(
      screen.getByRole("dialog", { name: "Timing bewerken" }),
    ).toBeInTheDocument()
    expect(window.location.hash).toBe(hashBeforeSelection)
    fireEvent.click(screen.getByRole("button", { name: "Sluiten" }))

    fireEvent.click(screen.getByRole("radio", { name: "Maand" }))
    fireEvent.change(screen.getByLabelText("Project"), {
      target: { value: testIds.projectOne },
    })
    await waitFor(() => {
      expect(window.location.hash).toContain(`project=${testIds.projectOne}`)
      expect(window.location.hash).toContain("zoom=month")
    })
    view.unmount()
    router.dispose()
  })

  it("voegt timing, een fase en een assettoewijzing toe zonder routewissel", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/planning`
    const router = createAppRouter()
    const view = render(<RouterProvider router={router} />)
    await screen.findByRole("heading", { name: "Project-Gantt" })
    const originalHash = window.location.hash

    fireEvent.click(screen.getByRole("button", { name: "+ Timingitem" }))
    let panel = screen.getByRole("dialog", { name: "Timingitem toevoegen" })
    fireEvent.change(within(panel).getByLabelText("Titel"), {
      target: { value: "E2E timingtopic" },
    })
    fireEvent.change(within(panel).getByLabelText("Startdatum"), {
      target: { value: "2026-10-01" },
    })
    fireEvent.change(within(panel).getByLabelText("Einddatum"), {
      target: { value: "2026-10-20" },
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Opslaan" }))
    await waitFor(() =>
      expect(
        useAppStore
          .getState()
          .session!.state.records.topics.some(
            (topic) => topic.title === "E2E timingtopic",
          ),
      ).toBe(true),
    )
    expect(window.location.hash).toBe(originalHash)

    fireEvent.click(screen.getByRole("button", { name: "+ Fase" }))
    panel = screen.getByRole("dialog", { name: "Fase toevoegen" })
    fireEvent.change(within(panel).getByLabelText("Naam"), {
      target: { value: "E2E uitvoeringsfase" },
    })
    fireEvent.change(within(panel).getByLabelText("Startdatum"), {
      target: { value: "2026-10-01" },
    })
    fireEvent.change(within(panel).getByLabelText("Einddatum"), {
      target: { value: "2026-11-30" },
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Opslaan" }))
    expect(await screen.findByText("E2E uitvoeringsfase")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "+ Asset" }))
    panel = screen.getByRole("dialog", { name: "Asset toevoegen" })
    fireEvent.change(within(panel).getByLabelText("Naam"), {
      target: { value: "E2E projectleider" },
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Opslaan" }))
    await waitFor(() =>
      expect(
        useAppStore
          .getState()
          .session!.state.records.resources.some(
            (resource) => resource.name === "E2E projectleider",
          ),
      ).toBe(true),
    )

    fireEvent.click(screen.getByRole("button", { name: "+ Toewijzing" }))
    panel = screen.getByRole("dialog", { name: "Asset toewijzen" })
    const resource = useAppStore
      .getState()
      .session!.state.records.resources.find(
        (item) => item.name === "E2E projectleider",
      )!
    fireEvent.change(within(panel).getByLabelText("Asset"), {
      target: { value: resource.id },
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Opslaan" }))
    await waitFor(() =>
      expect(
        useAppStore
          .getState()
          .session!.state.indices.assignmentsByProject.get(testIds.projectOne),
      ).toHaveLength(1),
    )
    expect(window.location.hash).toBe(originalHash)
    view.unmount()
    router.dispose()
  })
})
