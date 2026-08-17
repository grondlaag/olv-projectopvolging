import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { buildGlobalSearchResults } from "../application/queries"
import {
  cloneDomainCollections,
  normalizeDomainState,
} from "../application/services"
import { GlobalErrorBoundary } from "../design-system/components"
import type { AuditFields, LocalDate, UUID } from "../domain"
import { createPortfolioTestSession, testIds } from "./test-data"

const uuid = (value: string) => value as UUID
const date = (value: string) => value as LocalDate
const audit: AuditFields = {
  createdAt: "2026-08-09T09:00:00.000Z" as AuditFields["createdAt"],
  createdByActorId: testIds.actorOne,
  updatedAt: "2026-08-09T09:00:00.000Z" as AuditFields["updatedAt"],
  updatedByActorId: testIds.actorOne,
  active: true,
}

afterEach(() => vi.restoreAllMocks())

describe("fase 9 zoek-, fout- en indexhardening", () => {
  it("zoekt over alle operationele recordtypes en levert directe routes", () => {
    const records = cloneDomainCollections(
      createPortfolioTestSession().state.records,
    )
    const currentId = uuid("81000000-0000-4000-8000-000000000001")
    records.updates.push({
      id: currentId,
      objectType: "Topic",
      objectId: testIds.topicCritical,
      type: "Update",
      date: date("2026-08-09"),
      authorActorId: testIds.actorOne,
      text: "Unicode stand: patiëntenzone façade €",
      audit,
    })
    records.topics.find(
      (topic) => topic.id === testIds.topicCritical,
    )!.currentUpdateId = currentId
    records.meetings.push({
      id: uuid("82000000-0000-4000-8000-000000000001"),
      type: "Werfoverleg",
      scopeType: "Project",
      scopeId: testIds.projectOne,
      number: "OV-09",
      title: "Overleg patiëntenzone",
      date: date("2026-08-09"),
      status: "Concept",
      audit,
    })
    const state = normalizeDomainState(records)

    expect(buildGlobalSearchResults(state, "renovatie")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "Project",
          route: `/projects/${testIds.projectOne}`,
        }),
      ]),
    )
    expect(buildGlobalSearchResults(state, "zorgcampus")).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "Cluster" })]),
    )
    expect(buildGlobalSearchResults(state, "toegang")).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "Topic" })]),
    )
    expect(buildGlobalSearchResults(state, "topicactie")).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "Actie" })]),
    )
    expect(buildGlobalSearchResults(state, "patiëntenzone")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "Actuele stand" }),
        expect.objectContaining({ type: "Overleg" }),
      ]),
    )
    expect(buildGlobalSearchResults(state, "goedgekeurd")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "Beslissing",
          route: `/projects/${testIds.projectOne}/journal`,
        }),
      ]),
    )
  })

  it("bouwt de project-overlegindex zonder dubbele records", () => {
    const records = cloneDomainCollections(
      createPortfolioTestSession().state.records,
    )
    const projectMeetingId = uuid("83000000-0000-4000-8000-000000000001")
    const clusterMeetingId = uuid("83000000-0000-4000-8000-000000000002")
    const chapterMeetingId = uuid("83000000-0000-4000-8000-000000000003")
    records.meetings.push(
      {
        id: projectMeetingId,
        type: "Projectoverleg",
        scopeType: "Project",
        scopeId: testIds.projectOne,
        title: "Projectoverleg",
        date: date("2026-08-09"),
        status: "Concept",
        audit,
      },
      {
        id: clusterMeetingId,
        type: "Clusteroverleg",
        scopeType: "Cluster",
        scopeId: testIds.cluster,
        title: "Clusteroverleg",
        date: date("2026-08-10"),
        status: "Concept",
        audit,
      },
      {
        id: chapterMeetingId,
        type: "Hoofdstukoverleg",
        scopeType: "Hoofdstuk",
        scopeId: testIds.chapter,
        title: "Hoofdstukoverleg",
        date: date("2026-08-11"),
        status: "Concept",
        audit,
      },
    )

    const index = normalizeDomainState(records).indices.meetingsByProject
    expect(index.get(testIds.projectOne)?.map(({ id }) => id)).toEqual([
      projectMeetingId,
      clusterMeetingId,
      chapterMeetingId,
    ])
    expect(index.get(testIds.projectThree)?.map(({ id }) => id)).toEqual([
      chapterMeetingId,
    ])
  })

  it("toont een veilige globale foutstaat met herstelacties", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const Broken = () => {
      throw new Error("gevoelig technisch detail")
    }

    render(
      <GlobalErrorBoundary>
        <Broken />
      </GlobalErrorBoundary>,
    )

    expect(
      screen.getByRole("heading", {
        name: "Dit onderdeel kon niet worden weergegeven",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/lokale gegevens zijn niet automatisch verwijderd/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Opnieuw proberen" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Lokale sessie herstellen" }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Terug naar dashboard" }),
    )
    expect(window.location.hash).toBe("#/dashboard")
  })
})
