import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { RouterProvider } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"
import { createAppRouter } from "../app/routing"
import { useAppStore } from "../app/state/app-store"
import { createPortfolioTestSession, testIds } from "./test-data"

describe("topics in het projectjournaal", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.setState({
      session: createPortfolioTestSession(),
      loadedFileName: "portfolio-test.json",
    })
  })

  it("opent een topicdeeplink in dezelfde journaalcontext", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/topics/${testIds.topicCritical}`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole("main", { name: "Projectjournaal" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("complementary", { name: "Topiceigenschappen" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Titel")).toHaveValue("Toegang spoed")
    router.dispose()
  })

  it("maakt een topic inline en geeft het eerstvolgende stabiele T-nummer", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/journal`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    const newTopicButtons = await screen.findAllByRole("button", {
      name: /Nieuw topic/,
    })
    fireEvent.click(newTopicButtons[0]!)
    fireEvent.change(screen.getByLabelText("Titel nieuw topic"), {
      target: { value: "Brandcompartimentering" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Topic toevoegen" }))

    await waitFor(() => {
      const topic = useAppStore
        .getState()
        .session!.state.records.topics.find(
          (candidate) => candidate.title === "Brandcompartimentering",
        )
      expect(topic?.code).toBe("T-004")
    })
    expect(screen.getByText("Brandcompartimentering")).toBeInTheDocument()
    expect(useAppStore.getState().dirty).toBe(true)
    router.dispose()
  })
})
