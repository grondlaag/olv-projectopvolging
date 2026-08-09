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
import { createPortfolioTestSession } from "./test-data"

describe("projectformulier met inline beheer", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.setState({
      session: createPortfolioTestSession(),
      loadedFileName: "portfolio-test.xlsx",
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
      screen.getByText("Opgeslagen in sessie · nog exporteren"),
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
})
