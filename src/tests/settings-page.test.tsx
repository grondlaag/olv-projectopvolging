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
import { JsonDataFileGateway } from "../infrastructure/json"

describe("volwaardige instellingenpagina", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    const session = new JsonDataFileGateway().createNewSession()
    useAppStore.setState({
      session: { ...session, origin: "import" },
      loadedFileName: "instellingen-test.json",
      dirty: false,
    })
    window.location.hash = "#/settings"
  })

  it("voegt hoofdstuk, cluster, actor en keuzewaarde toe", async () => {
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole(
        "heading",
        { name: "Instellingen" },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("tab", { name: "Hoofdstukken en clusters" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "+ Hoofdstuk" }))
    let dialog = screen.getByRole("dialog", { name: "Nieuw hoofdstuk" })
    fireEvent.change(within(dialog).getByLabelText("Code"), {
      target: { value: "H4" },
    })
    fireEvent.change(within(dialog).getByLabelText("Titel"), {
      target: { value: "Digitale infrastructuur" },
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Hoofdstuk toevoegen" }),
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(screen.getByText("H4 · Digitale infrastructuur")).toBeInTheDocument()

    const chapter = useAppStore
      .getState()
      .session?.state.records.chapters.find((item) => item.code === "H4")
    fireEvent.click(
      screen.getAllByRole("button", { name: "+ Cluster" }).at(-1)!,
    )
    dialog = screen.getByRole("dialog", { name: "Nieuwe cluster" })
    fireEvent.change(within(dialog).getByLabelText("Hoofdstuk"), {
      target: { value: chapter?.id },
    })
    fireEvent.change(within(dialog).getByLabelText("Code"), {
      target: { value: "CL-DIG" },
    })
    fireEvent.change(within(dialog).getByLabelText("Naam"), {
      target: { value: "Digitale werkplek" },
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Cluster toevoegen" }),
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole("tab", { name: "Actoren" }))
    fireEvent.click(screen.getByRole("button", { name: "+ Actor" }))
    dialog = screen.getByRole("dialog", { name: "Nieuwe actor" })
    fireEvent.change(within(dialog).getByLabelText("Naam"), {
      target: { value: "Nieuwe beheerder" },
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Actor toevoegen" }),
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole("tab", { name: "Keuzelijsten" }))
    fireEvent.click(screen.getAllByRole("button", { name: "+ Waarde" })[0]!)
    dialog = screen.getByRole("dialog", { name: "Nieuwe keuzewaarde" })
    fireEvent.change(within(dialog).getByLabelText("Keuzelijst"), {
      target: { value: "site" },
    })
    fireEvent.change(within(dialog).getByLabelText("Technische sleutel"), {
      target: { value: "campus-west" },
    })
    fireEvent.change(within(dialog).getByLabelText("Label"), {
      target: { value: "Campus West" },
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Waarde toevoegen" }),
    )

    await waitFor(() => {
      const state = useAppStore.getState()
      expect(state.session?.state.records.clusters).toHaveLength(1)
      expect(state.session?.state.records.actors).toHaveLength(1)
      expect(
        state.session?.state.records.choiceLists.some(
          (item) => item.valueKey === "campus-west",
        ),
      ).toBe(true)
      expect(state.dirty).toBe(true)
    })
    router.dispose()
  })
})
