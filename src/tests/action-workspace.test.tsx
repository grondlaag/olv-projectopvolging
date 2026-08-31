import {
  act,
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

describe("actie-invoer en globale opvolging", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.setState({
      session: createPortfolioTestSession(),
      loadedFileName: "portfolio-test.json",
    })
  })

  it("maakt een journaalactie en volgt die zonder dubbel record globaal op", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/journal`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    const composer = await screen.findByLabelText(
      "Nieuwe bijdrage aan Toegang spoed",
    )
    const composerShell = composer.closest(".journal-composer") as HTMLElement
    fireEvent.click(
      within(composerShell).getByRole("button", { name: "Soort bijdrage" }),
    )
    fireEvent.click(
      within(composerShell).getByRole("menuitem", { name: "Actie" }),
    )
    fireEvent.change(composer, {
      target: { value: "Controleer medische toegang" },
    })
    fireEvent.keyDown(composer, { key: "Enter" })

    const editButton = await screen.findByRole("button", {
      name: /Inhoud van Controleer medische toegang bewerken/,
    })
    fireEvent.click(editButton.closest(".journal-entry") as HTMLElement)
    const panel = screen.getByRole("complementary", {
      name: "Entry-eigenschappen",
    })
    fireEvent.change(within(panel).getByLabelText("Eigenaar"), {
      target: { value: testIds.actorTwo },
    })
    const deadline = within(panel).getByLabelText("Deadline")
    fireEvent.change(deadline, {
      target: { value: "2026-08-30" },
    })
    fireEvent.blur(deadline)

    await waitFor(() => {
      const matches = useAppStore
        .getState()
        .session!.state.records.actions.filter(
          (action) => action.title === "Controleer medische toegang",
        )
      expect(matches).toHaveLength(1)
      expect(matches[0]).toMatchObject({
        objectType: "Topic",
        objectId: testIds.topicCritical,
        ownerActorId: testIds.actorTwo,
        deadline: "2026-08-30",
      })
    })

    await act(async () => {
      await router.navigate("/actions")
    })
    expect(
      await screen.findByRole("heading", { name: "Acties" }),
    ).toBeInTheDocument()
    fireEvent.change(
      screen.getByLabelText("Status van Controleer medische toegang"),
      {
        target: { value: "Bezig" },
      },
    )
    await waitFor(() => {
      const state = useAppStore.getState().session!.state
      const action = state.records.actions.find(
        (candidate) => candidate.title === "Controleer medische toegang",
      )!
      expect(action.status).toBe("Bezig")
      expect(state.indices.actionHistoryByAction.get(action.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "status",
            previousValue: "Open",
            newValue: "Bezig",
          }),
        ]),
      )
    })
    router.dispose()
  })

  it("opent en sluit een actie rechtstreeks via de URL", async () => {
    const action = useAppStore.getState().session!.state.records.actions[0]!
    window.location.hash = `#/actions?actie=${action.id}`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole("dialog", { name: "Actie bewerken" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Titel")).toHaveValue(action.title)
    fireEvent.click(screen.getByRole("button", { name: "Actiepaneel sluiten" }))
    await waitFor(() => expect(window.location.hash).toBe("#/actions"))
    router.dispose()
  })
})
