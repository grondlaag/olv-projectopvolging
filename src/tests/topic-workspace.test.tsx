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
import { createPortfolioTestSession, testIds } from "./test-data"

describe("topicwerkruimte", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.setState({
      session: createPortfolioTestSession(),
      loadedFileName: "portfolio-test.xlsx",
    })
  })

  it("maakt een projecttopic, actuele update en beslissing zonder formuliercontextverlies", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}?weergave=topics`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "+ Nieuw topic" },
        { timeout: 10_000 },
      ),
    )
    let panel = screen.getByRole("dialog", { name: "Nieuw topic" })
    fireEvent.change(within(panel).getByLabelText("Topiccode"), {
      target: { value: "TOP-NEW" },
    })
    fireEvent.change(within(panel).getByLabelText("Titel"), {
      target: { value: "Nieuwe projectvraag" },
    })
    fireEvent.change(within(panel).getByLabelText("Vaste context"), {
      target: { value: "Deze vaste context blijft bij het topic." },
    })
    fireEvent.change(within(panel).getByLabelText("Eigenaar"), {
      target: { value: testIds.actorOne },
    })
    fireEvent.change(within(panel).getByLabelText("Prioriteit"), {
      target: { value: "Hoog" },
    })
    fireEvent.click(
      within(panel).getByRole("button", { name: "Topic opslaan" }),
    )

    await waitFor(() =>
      expect(window.location.hash).toMatch(
        new RegExp(`^#/projects/${testIds.projectOne}/topics/[0-9a-f-]+$`),
      ),
    )
    expect(
      await screen.findByRole(
        "heading",
        { name: "Nieuwe projectvraag" },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument()
    expect(useAppStore.getState().dirty).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "+ Update" }))
    panel = screen.getByRole("form", { name: "Update toevoegen" })
    fireEvent.change(within(panel).getByLabelText("Schrijf een update"), {
      target: { value: "De uitvoering is klaar voor medische validatie." },
    })
    fireEvent.click(within(panel).getByLabelText("Maak actuele stand"))
    fireEvent.keyDown(panel, { key: "Enter", ctrlKey: true })

    expect(
      (
        await screen.findAllByText(
          "De uitvoering is klaar voor medische validatie.",
        )
      ).length,
    ).toBeGreaterThanOrEqual(2)

    fireEvent.click(screen.getByRole("button", { name: "+ Beslissing" }))
    panel = screen.getByRole("form", { name: "Beslissing toevoegen" })
    fireEvent.change(within(panel).getByLabelText("Schrijf een beslissing"), {
      target: { value: "De medische variant is formeel goedgekeurd." },
    })
    fireEvent.click(
      within(panel).getByRole("button", { name: "Beslissing toevoegen" }),
    )

    expect(
      await screen.findByText("De medische variant is formeel goedgekeurd."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Open acties" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "+ Actie" })).toBeInTheDocument()
    router.dispose()
  })

  it("opent een clusterroute rechtstreeks en maakt een clustertopic", async () => {
    window.location.hash = `#/clusters/${testIds.cluster}`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole("heading", { name: "Zorgcampus" }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getAllByRole("button", { name: "+ Nieuw topic" })[0]!,
    )
    const panel = screen.getByRole("dialog", { name: "Nieuw topic" })
    fireEvent.change(within(panel).getByLabelText("Topiccode"), {
      target: { value: "CL-TOP-01" },
    })
    fireEvent.change(within(panel).getByLabelText("Titel"), {
      target: { value: "Clusterbrede bereikbaarheid" },
    })
    fireEvent.change(within(panel).getByLabelText("Vaste context"), {
      target: { value: "Geldt voor alle projecten binnen de cluster." },
    })
    fireEvent.click(
      within(panel).getByRole("button", { name: "Topic opslaan" }),
    )

    await waitFor(() =>
      expect(window.location.hash).toMatch(
        new RegExp(`^#/clusters/${testIds.cluster}/topics/[0-9a-f-]+$`),
      ),
    )
    const created = useAppStore
      .getState()
      .session?.state.records.topics.find(
        (topic) => topic.title === "Clusterbrede bereikbaarheid",
      )
    expect(created).toMatchObject({
      parentType: "Cluster",
      clusterId: testIds.cluster,
    })
    expect(created?.projectId).toBeUndefined()
    router.dispose()
  })

  it("voegt topictiming toe met expliciete save en zet de sessie dirty", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/topics/${testIds.topicCritical}`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole("heading", { name: "Toegang spoed" }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "+ Timing" }))
    const panel = screen.getByRole("dialog", { name: "Timing toevoegen" })
    fireEvent.change(within(panel).getByLabelText("Startdatum"), {
      target: { value: "2026-08-10" },
    })
    fireEvent.change(within(panel).getByLabelText("Geplande einddatum"), {
      target: { value: "2026-09-30" },
    })
    fireEvent.change(within(panel).getByLabelText("Voortgang"), {
      target: { value: "35" },
    })
    fireEvent.change(within(panel).getByLabelText("Status"), {
      target: { value: "Op schema" },
    })
    fireEvent.click(
      within(panel).getByRole("button", { name: "Timing opslaan" }),
    )

    await waitFor(() =>
      expect(
        useAppStore
          .getState()
          .session?.state.indices.planningByTopic.get(testIds.topicCritical),
      ).toHaveLength(1),
    )
    expect(useAppStore.getState().dirty).toBe(true)
    expect(
      screen.getByText(
        "Timing opgeslagen in de lokale sessie · nog exporteren",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Timing bewerken" }),
    ).toBeInTheDocument()
    router.dispose()
  })
})
