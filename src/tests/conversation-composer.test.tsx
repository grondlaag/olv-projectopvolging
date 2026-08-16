import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useAppStore } from "../app/state/app-store"
import { ConversationComposer } from "../features/journal/conversation-composer"
import { createPortfolioTestSession, testIds } from "./test-data"

describe("universele invoerkaart", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.setState({ session: createPortfolioTestSession() })
  })

  it("slaat updates en beslissingen append-only in dezelfde topiccontext op", async () => {
    render(
      <ConversationComposer
        contextType="Topic"
        contextId={testIds.topicCritical}
        contextLabel="TOP-001 · Toegang spoed"
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/Wat is er gewijzigd/), {
      target: { value: "Nieuwe stand vanuit de invoerkaart." },
    })
    fireEvent.click(screen.getByLabelText("Maak actuele stand"))
    fireEvent.click(screen.getByRole("button", { name: "Update opslaan" }))

    await waitFor(() =>
      expect(
        useAppStore
          .getState()
          .session?.state.indices.updatesByObject.get(
            `Topic:${testIds.topicCritical}`,
          )
          ?.at(-1),
      ).toMatchObject({
        type: "Update",
        text: "Nieuwe stand vanuit de invoerkaart.",
      }),
    )

    fireEvent.click(screen.getByRole("button", { name: "Beslissing" }))
    fireEvent.change(
      screen.getByPlaceholderText("Welke beslissing is genomen?"),
      {
        target: { value: "We keuren de tijdelijke route goed." },
      },
    )
    fireEvent.click(screen.getByRole("button", { name: "Beslissing opslaan" }))

    await waitFor(() =>
      expect(
        useAppStore
          .getState()
          .session?.state.indices.updatesByObject.get(
            `Topic:${testIds.topicCritical}`,
          )
          ?.filter((entry) => entry.type === "Beslissing"),
      ).toHaveLength(1),
    )
    expect(useAppStore.getState().dirty).toBe(true)
  })

  it("maakt vanuit dezelfde kaart een actie met eigenaar", async () => {
    render(
      <ConversationComposer
        contextType="Project"
        contextId={testIds.projectOne}
        contextLabel="PRJ-001 · Spoed"
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Actie" }))
    fireEvent.change(screen.getByPlaceholderText("Wat moet gebeuren?"), {
      target: { value: "Controleer de toegangsroute." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Actie opslaan" }))

    await waitFor(() =>
      expect(
        useAppStore
          .getState()
          .session?.state.indices.actionsByObject.get(
            `Project:${testIds.projectOne}`,
          )
          ?.at(-1),
      ).toMatchObject({
        title: "Controleer de toegangsroute.",
        status: "Open",
      }),
    )
  })
})
