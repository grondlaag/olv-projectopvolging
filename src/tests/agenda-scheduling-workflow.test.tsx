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

describe("project en topic inplannen voor overleg", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.setState({
      session: sessionWithPlannedMeeting(),
      loadedFileName: "portfolio-test.json",
    })
  })

  it("plaatst een project vanuit het dossier op een geldige overlegagenda", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    fireEvent.click(
      await screen.findByRole("button", { name: "Projectacties" }),
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: "Project bespreken op overleg",
      }),
    )
    const panel = screen.getByRole("dialog", {
      name: "Bespreken op overleg",
    })
    fireEvent.click(
      within(panel).getByRole("radio", { name: /Projectoverleg januari/ }),
    )
    fireEvent.change(
      within(panel).getByLabelText("Reden of gewenste bespreking"),
      { target: { value: "Bespreek de actuele projectrisico's." } },
    )
    fireEvent.click(
      within(panel).getByRole("button", { name: "Op agenda plaatsen" }),
    )

    await waitFor(() =>
      expect(
        useAppStore
          .getState()
          .session?.state.indices.agendaItemsByObject.get(
            `Project:${testIds.projectOne}`,
          ),
      ).toHaveLength(1),
    )
    expect(
      screen.getByText(
        "Ingepland voor overleg in de lokale sessie · back-up nodig",
      ),
    ).toBeInTheDocument()
    expect(useAppStore.getState().dirty).toBe(true)
    router.dispose()
  })

  it("plaatst een topic vanuit de topicwerkruimte op de overlegagenda", async () => {
    window.location.hash = `#/projects/${testIds.projectOne}/topics/${testIds.topicCritical}`
    const router = createAppRouter()
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole("heading", { name: "Toegang spoed" }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Topicacties" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Bespreken op overleg" }),
    )
    const panel = screen.getByRole("dialog", {
      name: "Bespreken op overleg",
    })
    fireEvent.click(
      within(panel).getByRole("radio", { name: /Projectoverleg januari/ }),
    )
    fireEvent.click(
      within(panel).getByRole("button", { name: "Op agenda plaatsen" }),
    )

    await waitFor(() =>
      expect(
        useAppStore
          .getState()
          .session?.state.indices.agendaItemsByObject.get(
            `Topic:${testIds.topicCritical}`,
          )?.[0],
      ).toMatchObject({ meetingId, discussionStatus: "Te bespreken" }),
    )
    expect(await screen.findByText("1 keer ingepland")).toBeInTheDocument()
    expect(useAppStore.getState().dirty).toBe(true)
    router.dispose()
  })
})
