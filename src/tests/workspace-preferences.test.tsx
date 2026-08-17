import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { RouterProvider } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"
import { workspacePreferencesStorageKey } from "../app/preferences/workspace-preferences"
import { createAppRouter } from "../app/routing"
import { useAppStore } from "../app/state/app-store"
import { createPortfolioTestSession, testIds } from "./test-data"

describe("persoonlijke werkruimtevoorkeuren", () => {
  beforeEach(() => {
    useAppStore.setState({
      session: createPortfolioTestSession(),
      loadedFileName: "portfolio-test.json",
    })
  })

  it("biedt sneltoetsen, favorieten en contextgevoelige actie-invoer", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole("heading", {
        name: "Renovatie verpleegafdeling",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("Snel bereikbaar")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Als favoriet" }))
    expect(screen.getByRole("button", { name: "Favoriet" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )

    fireEvent.keyDown(window, { key: "?" })
    expect(
      screen.getByRole("dialog", { name: "Sneltoetsen" }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Sneltoetsen sluiten" }))

    fireEvent.keyDown(window, { key: "n" })
    const menu = screen.getByRole("menu")
    expect(
      within(menu).getByRole("menuitem", { name: /Topic in dit project/ }),
    ).toBeInTheDocument()
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: /Actie bij dit project/ }),
    )

    const panel = await screen.findByRole("dialog", {
      name: "Actie toevoegen",
    })
    expect(
      within(panel).getByText("Renovatie verpleegafdeling"),
    ).toBeInTheDocument()
    fireEvent.change(within(panel).getByLabelText("Titel"), {
      target: { value: "Controleer contextuele invoer" },
    })
    fireEvent.change(within(panel).getByLabelText("Eigenaar"), {
      target: { value: testIds.actorOne },
    })
    fireEvent.click(
      within(panel).getByRole("button", { name: "Actie opslaan" }),
    )

    await waitFor(() =>
      expect(window.location.hash).toBe(`#/projects/${testIds.projectOne}`),
    )
    expect(
      useAppStore
        .getState()
        .session!.state.records.actions.find(
          (action) => action.title === "Controleer contextuele invoer",
        ),
    ).toMatchObject({
      objectType: "Project",
      objectId: testIds.projectOne,
    })
    router.dispose()
  })

  it("bewaart filters en tabelweergave en wijzigt acties in bulk", async () => {
    window.location.hash = "#/actions?scope=all"
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole("heading", { name: "Acties" }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "Bezig" },
    })
    fireEvent.click(screen.getByRole("button", { name: "+ Weergave bewaren" }))
    fireEvent.change(screen.getByLabelText("Naam van weergave"), {
      target: { value: "Acties in uitvoering" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Bewaren" }))

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "" },
    })
    fireEvent.change(screen.getByLabelText("Opgeslagen weergave"), {
      target: {
        value: screen
          .getByRole("option", { name: "Acties in uitvoering" })
          .getAttribute("value"),
      },
    })
    expect(window.location.hash).toContain("status=Bezig")
    expect(
      window.localStorage.getItem(workspacePreferencesStorageKey),
    ).toContain("Acties in uitvoering")

    fireEvent.click(screen.getByRole("button", { name: "Tabelweergave" }))
    const display = screen.getByRole("dialog", {
      name: "Tabelweergave instellen",
    })
    fireEvent.click(within(display).getByRole("radio", { name: "Compact" }))
    fireEvent.click(within(display).getByRole("checkbox", { name: "Topic" }))
    fireEvent.click(within(display).getByRole("button", { name: "Sluiten" }))
    expect(screen.getByRole("table")).toHaveAttribute("data-density", "compact")
    expect(
      screen.queryByRole("columnheader", { name: "Topic" }),
    ).not.toBeInTheDocument()
    expect(useAppStore.getState().dirty).toBe(false)

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "" },
    })
    fireEvent.click(screen.getByLabelText("Selecteer Achterstallige actie"))
    fireEvent.click(screen.getByLabelText("Selecteer Topicactie"))
    const bulk = screen.getByRole("region", { name: "Bulkacties" })
    expect(within(bulk).getByText("2 geselecteerd")).toBeInTheDocument()
    fireEvent.change(within(bulk).getByLabelText("Status"), {
      target: { value: "Geannuleerd" },
    })
    fireEvent.click(
      within(bulk).getByRole("button", { name: "Wijziging toepassen" }),
    )

    await waitFor(() => {
      const state = useAppStore.getState().session!.state
      expect(
        state.records.actions.find(
          (item) => item.title === "Achterstallige actie",
        )?.status,
      ).toBe("Geannuleerd")
      expect(
        state.records.actions.find((item) => item.title === "Topicactie")
          ?.status,
      ).toBe("Geannuleerd")
      for (const action of state.records.actions.filter((item) =>
        ["Achterstallige actie", "Topicactie"].includes(item.title),
      )) {
        expect(state.indices.actionHistoryByAction.get(action.id)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: "status",
              newValue: "Geannuleerd",
            }),
          ]),
        )
      }
    })
    expect(useAppStore.getState().dirty).toBe(true)
    router.dispose()
  })
})
