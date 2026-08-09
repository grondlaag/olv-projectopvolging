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
      loadedFileName: "portfolio-test.xlsx",
    })
  })

  it("maakt vanuit een topic een actie en actor zonder invoerverlies", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/topics/${testIds.topicCritical}`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    fireEvent.click(await screen.findByRole("button", { name: "+ Actie" }))
    let panel = screen.getByRole("dialog", { name: "Actie toevoegen" })
    fireEvent.change(within(panel).getByLabelText("Titel"), {
      target: { value: "Controleer medische toegang" },
    })
    fireEvent.change(within(panel).getByLabelText(/Deadline/), {
      target: { value: "2026-08-30" },
    })
    fireEvent.click(
      within(panel).getByRole("button", { name: "+ Nieuwe actor" }),
    )

    panel = screen.getByRole("dialog", { name: "Nieuwe actor" })
    fireEvent.change(within(panel).getByLabelText("Naam"), {
      target: { value: "Nieuwe Actiehouder" },
    })
    fireEvent.change(within(panel).getByLabelText("E-mail"), {
      target: { value: "actiehouder@example.test" },
    })
    fireEvent.click(
      within(panel).getByRole("button", { name: "Actor opslaan" }),
    )

    panel = await screen.findByRole("dialog", { name: "Actie toevoegen" })
    expect(within(panel).getByLabelText("Titel")).toHaveValue(
      "Controleer medische toegang",
    )
    expect(within(panel).getByLabelText(/Deadline/)).toHaveValue("2026-08-30")
    expect(within(panel).getByLabelText("Eigenaar")).toHaveDisplayValue(
      "Nieuwe Actiehouder",
    )
    fireEvent.click(
      within(panel).getByRole("button", { name: "Actie opslaan" }),
    )

    await waitFor(() => {
      const created = useAppStore
        .getState()
        .session?.state.records.actions.find(
          (action) => action.title === "Controleer medische toegang",
        )
      expect(created).toMatchObject({
        objectType: "Topic",
        objectId: testIds.topicCritical,
        deadline: "2026-08-30",
      })
    })
    expect(useAppStore.getState().dirty).toBe(true)
    expect(screen.getByText("Controleer medische toegang")).toBeInTheDocument()

    await act(async () => {
      await router.navigate("/actions")
    })
    expect(
      await screen.findByRole("heading", { name: "Acties" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Controleer medische toegang/ }),
    ).toBeInTheDocument()
    fireEvent.change(
      screen.getByLabelText("Status van Controleer medische toegang"),
      { target: { value: "Bezig" } },
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
    expect(
      screen.getByText("Actiestatus bijgewerkt · nog exporteren"),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Per eigenaar" }))
    expect(
      screen.getByRole("heading", { name: "Nieuwe Actiehouder" }),
    ).toBeInTheDocument()
    router.dispose()
  })
})
