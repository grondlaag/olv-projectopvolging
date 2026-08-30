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
import type { LocalDate, Meeting, UUID } from "../domain"
import { createPortfolioTestSession, testIds } from "./test-data"

const meetingId = "a1000000-0000-4000-8000-000000000001" as UUID

function sessionWithPlannedMeeting() {
  const session = createPortfolioTestSession()
  const records = structuredClone(session.state.records)
  const meeting: Meeting = {
    id: meetingId,
    type: "Projectoverleg",
    scopeType: "Project",
    scopeId: testIds.projectOne,
    title: "Projectoverleg januari",
    date: "2099-01-12" as LocalDate,
    status: "Concept",
    audit: structuredClone(records.projects[0]!.audit),
  }
  records.meetings.push(meeting)
  return { ...session, state: normalizeDomainState(records) }
}

describe("journaalitems inplannen voor overleg", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.setState({
      session: sessionWithPlannedMeeting(),
      loadedFileName: "portfolio-test.json",
    })
  })

  it("koppelt een entry via Eigenschappen aan een overlegcontext", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/journal`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    const editButton = await screen.findByRole("button", {
      name: /Inhoud van Topicactie bewerken/,
    })
    fireEvent.click(editButton.closest(".journal-entry") as HTMLElement)
    const panel = screen.getByRole("complementary", {
      name: "Entry-eigenschappen",
    })
    fireEvent.change(within(panel).getByLabelText("Vergadering kiezen"), {
      target: { value: meetingId },
    })
    fireEvent.click(within(panel).getByRole("button", { name: "+ Voeg toe" }))

    await waitFor(() => {
      const state = useAppStore.getState().session!.state
      expect(
        state.records.evidence.some(
          (evidence) =>
            evidence.type === "MeetingLink" &&
            evidence.objectType === "Action" &&
            evidence.objectId === "60000000-0000-4000-8000-000000000002",
        ),
      ).toBe(true)
      expect(
        state.indices.agendaItemsByObject.get(`Topic:${testIds.topicCritical}`),
      ).toHaveLength(1)
    })
    expect(
      within(panel).getByText("Projectoverleg januari"),
    ).toBeInTheDocument()
    expect(useAppStore.getState().dirty).toBe(true)
    router.dispose()
  })
})
