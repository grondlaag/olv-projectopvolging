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
import { MeetingManagementService } from "../application/services"
import type { LocalDate } from "../domain"
import { createPortfolioTestSession, testIds } from "./test-data"

const service = new MeetingManagementService()

describe("overlegwerkruimte", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.setState({
      session: createPortfolioTestSession(),
      loadedFileName: "portfolio-test.json",
    })
  })

  it("maakt een overleg en inline actor zonder formuliercontextverlies", async () => {
    window.location.hash = "#/meetings/new"
    const router = createAppRouter()
    const view = render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole("heading", { name: "Nieuw overleg" }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Titel"), {
      target: { value: "Multidisciplinair werfoverleg" },
    })
    fireEvent.change(screen.getByLabelText("Scope"), {
      target: { value: testIds.projectOne },
    })
    fireEvent.click(screen.getByLabelText(/Anna/))
    fireEvent.click(screen.getByRole("button", { name: "+ Nieuwe actor" }))

    const actorPanel = screen.getByRole("dialog", { name: "Nieuwe actor" })
    fireEvent.change(within(actorPanel).getByLabelText("Naam"), {
      target: { value: "Nieuwe overlegdeelnemer" },
    })
    fireEvent.click(
      within(actorPanel).getByRole("button", { name: "Actor opslaan" }),
    )

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Nieuwe actor" }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText("Titel")).toHaveValue(
      "Multidisciplinair werfoverleg",
    )
    expect(
      screen.getByRole("checkbox", { name: /Nieuwe overlegdeelnemer/ }),
    ).toBeChecked()
    fireEvent.click(screen.getByRole("button", { name: "Overleg opslaan" }))

    expect(
      await screen.findByRole(
        "heading",
        { name: "Multidisciplinair werfoverleg" },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument()
    expect(window.location.hash).toMatch(/^#\/meetings\/[0-9a-f-]+$/)
    expect(useAppStore.getState().dirty).toBe(true)
    expect(
      useAppStore.getState().session?.state.records.meetingParticipants,
    ).toHaveLength(2)
    view.unmount()
    router.dispose()
  })

  it("bereidt voor, verwerkt en bevriest een professioneel verslag", async () => {
    const base = createPortfolioTestSession()
    const created = service.createMeeting(base.state, {
      type: "Projectoverleg",
      scopeType: "Project",
      scopeId: testIds.projectOne,
      number: "OV-TEST-01",
      title: "Overleg tijdelijke toegang",
      date: "2026-08-10" as LocalDate,
      chairActorId: testIds.actorOne,
      reporterActorId: testIds.actorTwo,
      status: "Concept",
      participants: [
        { actorId: testIds.actorOne, attended: false },
        { actorId: testIds.actorTwo, attended: false },
      ],
    })
    useAppStore.setState({ session: { ...base, state: created.state } })
    window.location.hash = `#/meetings/${created.record.id}`
    const router = createAppRouter()
    const view = render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole(
        "heading",
        { name: "Overleg tijdelijke toegang" },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument()
    const suggestion = screen
      .getByText("TOP-001 · Toegang spoed")
      .closest("li")!
    fireEvent.click(
      within(suggestion).getByRole("button", { name: "Toevoegen" }),
    )
    expect(
      await screen.findByText(
        "Suggestie aan de agenda toegevoegd · JSON nog opslaan",
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /^Verwerken/ }))
    fireEvent.click(screen.getByLabelText(/Anna/))
    fireEvent.change(
      screen.getByLabelText("Topicstatus TOP-001 · Toegang spoed"),
      { target: { value: "Afgesloten" } },
    )
    expect(
      useAppStore
        .getState()
        .session?.state.indices.topicById.get(testIds.topicCritical)?.status,
    ).toBe("Afgesloten")
    const agendaItem = screen
      .getByText("TOP-001 · Toegang spoed")
      .closest("li")!
    fireEvent.click(
      within(agendaItem).getByRole("button", { name: "+ Update" }),
    )
    let panel = screen.getByRole("dialog", { name: "Update toevoegen" })
    fireEvent.change(within(panel).getByLabelText("Bijdrage"), {
      target: { value: "Toegang is technisch gevalideerd." },
    })
    fireEvent.click(
      within(panel).getByRole("button", { name: "Update opslaan" }),
    )
    expect(
      await screen.findByText("Toegang is technisch gevalideerd."),
    ).toBeInTheDocument()

    const refreshedAgendaItem = screen
      .getByText("TOP-001 · Toegang spoed")
      .closest("li")!
    fireEvent.click(
      within(refreshedAgendaItem).getByRole("button", {
        name: "+ Beslissing",
      }),
    )
    panel = screen.getByRole("dialog", { name: "Beslissing toevoegen" })
    fireEvent.change(within(panel).getByLabelText("Beslissing"), {
      target: { value: "De technische variant is goedgekeurd." },
    })
    fireEvent.click(
      within(panel).getByRole("button", { name: "Beslissing opslaan" }),
    )
    expect(
      await screen.findByText("De technische variant is goedgekeurd."),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "Conceptverslag opbouwen" }),
    )
    expect(
      await screen.findByRole("heading", { name: "Verslag versie 1" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("De technische variant is goedgekeurd."),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Definitief maken" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Ja, definitief maken" }),
    )

    await waitFor(() =>
      expect(
        useAppStore
          .getState()
          .session?.state.indices.meetingById.get(created.record.id)?.status,
      ).toBe("Definitief"),
    )
    expect(screen.getByText("Historisch vastgelegd")).toBeInTheDocument()
    expect(
      useAppStore.getState().session?.state.records.reports[0],
    ).toMatchObject({ version: 1, status: "Definitief" })
    view.unmount()
    router.dispose()
  })
})
