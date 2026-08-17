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

  it("neemt een geldige projectscope uit context over", async () => {
    window.location.hash = `#/meetings/new?scopeType=Project&scopeId=${testIds.projectOne}`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole("heading", { name: "Nieuw overleg" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Scopetype")).toHaveValue("Project")
    expect(screen.getByLabelText("Scope")).toHaveValue(testIds.projectOne)
    router.dispose()
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

  it("herstelt overlegfilters rechtstreeks uit de URL", async () => {
    window.location.hash = "#/meetings?status=Concept&scope=Project"
    const router = createAppRouter()
    const view = render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole("heading", { name: "Overleg" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Status")).toHaveValue("Concept")
    expect(screen.getByLabelText("Scope")).toHaveValue("Project")
    fireEvent.change(screen.getByLabelText("Vanaf"), {
      target: { value: "2026-08-01" },
    })
    expect(window.location.hash).toContain("vanaf=2026-08-01")
    view.unmount()
    router.dispose()
  })

  it("maakt vanuit het dossier een vervolgoverleg met open agenda en bronlink", async () => {
    const base = createPortfolioTestSession()
    const source = service.createMeeting(base.state, {
      type: "Projectoverleg",
      scopeType: "Project",
      scopeId: testIds.projectOne,
      title: "Maandelijks werfoverleg",
      date: "2026-08-10" as LocalDate,
      nextMeetingDate: "2026-09-10" as LocalDate,
      chairActorId: testIds.actorOne,
      status: "Concept",
      participants: [{ actorId: testIds.actorOne, attended: false }],
    })
    const agenda = service.saveAgendaItem(source.state, source.record.id, {
      title: "Tijdelijke toegang",
      discussionStatus: "Doorgeschoven",
      objectType: "Topic",
      objectId: testIds.topicCritical,
    })
    useAppStore.setState({ session: { ...base, state: agenda.state } })
    window.location.hash = `#/meetings/${source.record.id}`
    const router = createAppRouter()
    const view = render(<RouterProvider router={router} />)

    fireEvent.click(
      await screen.findByRole("button", { name: "Overlegacties" }),
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Vervolgoverleg maken" }),
    )
    expect(
      await screen.findByRole("heading", { name: "Vervolgoverleg maken" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Titel")).toHaveValue(
      "Maandelijks werfoverleg",
    )
    expect(screen.getByLabelText("Datum")).toHaveValue("2026-09-10")
    expect(screen.getByText(/1 open agendapunten/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Overleg opslaan" }))
    await waitFor(() =>
      expect(
        useAppStore.getState().session!.state.records.meetings,
      ).toHaveLength(2),
    )
    const created = useAppStore
      .getState()
      .session!.state.records.meetings.find(
        (meeting) => meeting.id !== source.record.id,
      )!
    expect(created.sourceMeetingId).toBe(source.record.id)
    expect(
      useAppStore
        .getState()
        .session!.state.indices.agendaItemsByMeeting.get(created.id),
    ).toEqual([
      expect.objectContaining({
        title: "Tijdelijke toegang",
        discussionStatus: "Te bespreken",
      }),
    ])
    expect(await screen.findByText("Vervolg op")).toBeInTheDocument()
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
        "Suggestie aan de agenda toegevoegd · back-up nodig",
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /^Verwerken/ }))
    expect(window.location.hash).toContain("modus=process")
    fireEvent.click(screen.getByLabelText(/Anna/))
    fireEvent.click(screen.getByRole("button", { name: "Focusmodus" }))
    expect(
      screen.getByRole("button", { name: "Overzicht tonen" }),
    ).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Overzicht tonen" }))
    fireEvent.click(screen.getByRole("button", { name: "Punt besproken" }))
    expect(
      useAppStore
        .getState()
        .session?.state.indices.agendaItemsByMeeting.get(created.record.id)?.[0]
        ?.discussionStatus,
    ).toBe("Besproken")
    fireEvent.change(screen.getByLabelText("Topicstatus"), {
      target: { value: "Afgesloten" },
    })
    expect(
      useAppStore
        .getState()
        .session?.state.indices.topicById.get(testIds.topicCritical)?.status,
    ).toBe("Afgesloten")
    const composer = screen.getByRole("form", {
      name: /Bijdrage toevoegen aan TOP-001/,
    })
    fireEvent.change(
      within(composer).getByPlaceholderText(/Wat is er gewijzigd/),
      {
        target: { value: "Toegang is technisch gevalideerd." },
      },
    )
    fireEvent.click(
      within(composer).getByRole("button", { name: "Update opslaan" }),
    )
    expect(
      await screen.findByText("Toegang is technisch gevalideerd."),
    ).toBeInTheDocument()

    fireEvent.click(
      within(composer).getByRole("button", { name: "Beslissing" }),
    )
    fireEvent.change(
      within(composer).getByPlaceholderText(/Welke beslissing/),
      {
        target: { value: "De technische variant is goedgekeurd." },
      },
    )
    fireEvent.click(
      within(composer).getByRole("button", { name: "Beslissing opslaan" }),
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
    expect(window.location.hash).toContain("modus=report")
    expect(window.location.hash).toContain("versie=1")
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
