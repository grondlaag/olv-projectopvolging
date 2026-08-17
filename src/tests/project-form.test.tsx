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
import { normalizeDomainState } from "../application/services"
import { createPortfolioTestSession, testIds } from "./test-data"

describe("projectformulier met inline beheer", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.setState({
      session: createPortfolioTestSession(),
      loadedFileName: "portfolio-test.json",
    })
    window.location.hash = "#/projects/new"
  })

  it("behoudt projectinvoer bij inline actor en cluster en zet dirty na save", async () => {
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    fireEvent.change(await screen.findByLabelText("Projectcode"), {
      target: { value: "PRJ-NEW" },
    })
    fireEvent.change(screen.getByLabelText("Titel"), {
      target: { value: "Project met bewaarde invoer" },
    })
    fireEvent.change(screen.getByLabelText("Hoofdstuk"), {
      target: { value: "10000000-0000-4000-8000-000000000001" },
    })

    fireEvent.click(screen.getByRole("button", { name: "+ Nieuwe actor" }))
    const actorDialog = screen.getByRole("dialog", { name: "Nieuwe actor" })
    fireEvent.change(within(actorDialog).getByLabelText("Naam"), {
      target: { value: "Inline coördinator" },
    })
    fireEvent.click(
      within(actorDialog).getByRole("button", { name: "Actor opslaan" }),
    )

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Nieuwe actor" }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText("Titel")).toHaveValue(
      "Project met bewaarde invoer",
    )
    expect(screen.getByLabelText(/Projectcoördinator/)).toHaveDisplayValue(
      "Inline coördinator",
    )

    fireEvent.click(screen.getByRole("button", { name: "+ Nieuwe cluster" }))
    const clusterDialog = screen.getByRole("dialog", { name: "Nieuwe cluster" })
    fireEvent.change(within(clusterDialog).getByLabelText("Clustercode"), {
      target: { value: "CL-INLINE" },
    })
    fireEvent.change(within(clusterDialog).getByLabelText("Clusternaam"), {
      target: { value: "Inline cluster" },
    })
    fireEvent.click(
      within(clusterDialog).getByRole("button", { name: "Cluster opslaan" }),
    )

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Nieuwe cluster" }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText("Titel")).toHaveValue(
      "Project met bewaarde invoer",
    )
    expect(screen.getByLabelText(/Cluster/)).toHaveDisplayValue(
      "CL-INLINE · Inline cluster",
    )
    fireEvent.click(screen.getByRole("button", { name: "Project opslaan" }))

    await waitFor(
      () => {
        expect(
          useAppStore.getState().session?.state.records.projects,
        ).toHaveLength(4)
      },
      { timeout: 5_000 },
    )

    await waitFor(
      () => {
        expect(window.location.hash).toMatch(/^#\/projects\/[0-9a-f-]+$/)
      },
      { timeout: 5_000 },
    )

    expect(
      await screen.findByRole(
        "heading",
        {
          name: "Project met bewaarde invoer",
        },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Bewaard in lokale sessie · back-up nodig"),
    ).toBeInTheDocument()
    expect(useAppStore.getState().dirty).toBe(true)
    expect(useAppStore.getState().session?.state.records.projects).toHaveLength(
      4,
    )
    router.dispose()
  })

  it("toont rustige veldfouten en muteert niets bij ongeldige invoer", async () => {
    const router = createAppRouter()
    render(<RouterProvider router={router} />)
    const originalCount =
      useAppStore.getState().session?.state.records.projects.length ?? 0

    fireEvent.click(
      await screen.findByRole("button", { name: "Project opslaan" }),
    )

    expect(
      await screen.findByText("Projectcode is verplicht."),
    ).toBeInTheDocument()
    expect(screen.getByText("Titel is verplicht.")).toBeInTheDocument()
    expect(screen.getByText("Hoofdstuk is verplicht.")).toBeInTheDocument()
    expect(useAppStore.getState().session?.state.records.projects).toHaveLength(
      originalCount,
    )
    router.dispose()
  })

  it("kan een hoofdstuk en cluster toevoegen en onmiddellijk selecteren", async () => {
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    fireEvent.change(await screen.findByLabelText("Projectcode"), {
      target: { value: "PRJ-STRUCT" },
    })
    fireEvent.change(screen.getByLabelText("Titel"), {
      target: { value: "Project met nieuwe structuur" },
    })
    fireEvent.click(screen.getByRole("button", { name: "+ Nieuw hoofdstuk" }))
    const chapterDialog = screen.getByRole("dialog", {
      name: "Nieuw hoofdstuk",
    })
    fireEvent.change(within(chapterDialog).getByLabelText("Hoofdstukcode"), {
      target: { value: "H-NEW" },
    })
    fireEvent.change(within(chapterDialog).getByLabelText("Hoofdstuktitel"), {
      target: { value: "Nieuw beheerhoofdstuk" },
    })
    fireEvent.click(
      within(chapterDialog).getByRole("button", {
        name: "Hoofdstuk opslaan",
      }),
    )

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText("Hoofdstuk")).toHaveDisplayValue(
      "H-NEW · Nieuw beheerhoofdstuk",
    )

    fireEvent.click(screen.getByRole("button", { name: "+ Nieuwe cluster" }))
    const clusterDialog = screen.getByRole("dialog", { name: "Nieuwe cluster" })
    fireEvent.change(within(clusterDialog).getByLabelText("Clustercode"), {
      target: { value: "CL-NEW" },
    })
    fireEvent.change(within(clusterDialog).getByLabelText("Clusternaam"), {
      target: { value: "Nieuwe beheercluster" },
    })
    fireEvent.click(
      within(clusterDialog).getByRole("button", { name: "Cluster opslaan" }),
    )

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText(/Cluster/)).toHaveDisplayValue(
      "CL-NEW · Nieuwe beheercluster",
    )

    fireEvent.click(screen.getByRole("button", { name: "Project opslaan" }))
    await waitFor(() => {
      const project = useAppStore
        .getState()
        .session?.state.records.projects.find(
          (item) => item.code === "PRJ-STRUCT",
        )
      const chapter = useAppStore
        .getState()
        .session?.state.records.chapters.find((item) => item.code === "H-NEW")
      const cluster = useAppStore
        .getState()
        .session?.state.records.clusters.find((item) => item.code === "CL-NEW")
      expect(project?.chapterId).toBe(chapter?.id)
      expect(project?.clusterId).toBe(cluster?.id)
    })
    router.dispose()
  })

  it("gebruikt vanuit Planning dezelfde volledige editor en keert met alle velden terug", async () => {
    const session = createPortfolioTestSession()
    const records = structuredClone(session.state.records)
    const project = records.projects.find(
      (item) => item.id === testIds.projectOne,
    )!
    project.size = "L"
    useAppStore.setState({
      session: { ...session, state: normalizeDomainState(records) },
      loadedFileName: "portfolio-test.json",
    })
    window.location.hash = `#/projects/${testIds.projectOne}/planning`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Project bewerken" },
        { timeout: 10_000 },
      ),
    )
    expect(await screen.findByLabelText(/Projectomvang/)).toHaveValue("L")
    fireEvent.change(screen.getByLabelText("Titel"), {
      target: { value: "Renovatie met behouden omvang" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Wijzigingen opslaan" }))

    await waitFor(() =>
      expect(window.location.hash).toBe(
        `#/projects/${testIds.projectOne}/planning`,
      ),
    )
    expect(
      await screen.findByRole(
        "heading",
        { name: "Renovatie met behouden omvang" },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument()
    expect(
      useAppStore
        .getState()
        .session?.state.indices.projectById.get(testIds.projectOne),
    ).toMatchObject({ title: "Renovatie met behouden omvang", size: "L" })
    expect(
      within(
        screen.getByRole("navigation", { name: "Projectdossierweergave" }),
      ).getByRole("link", { name: "Planning" }),
    ).toHaveAttribute("aria-current", "page")
    router.dispose()
  }, 30_000)

  it("waarschuwt voordat niet-opgeslagen formulierinvoer wordt verlaten", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/edit`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    fireEvent.change(await screen.findByLabelText("Titel"), {
      target: { value: "Nog niet bewaarde titel" },
    })
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Kruimelpad" })).getByRole(
        "link",
        { name: "Portfolio" },
      ),
    )

    const guard = await screen.findByRole("alertdialog", {
      name: "Deze wijzigingen zijn nog niet toegepast",
    })
    expect(window.location.hash).toBe(`#/projects/${testIds.projectOne}/edit`)
    fireEvent.click(
      within(guard).getByRole("button", { name: "Verder bewerken" }),
    )
    expect(screen.getByLabelText("Titel")).toHaveValue(
      "Nog niet bewaarde titel",
    )

    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Kruimelpad" })).getByRole(
        "link",
        { name: "Portfolio" },
      ),
    )
    fireEvent.click(
      await screen.findByRole("button", { name: "Invoer verwerpen" }),
    )
    await waitFor(() => expect(window.location.hash).toBe("#/portfolio"))
    router.dispose()
  })
})
