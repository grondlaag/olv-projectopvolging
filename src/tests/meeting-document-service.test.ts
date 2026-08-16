// @vitest-environment node

import { describe, expect, it } from "vitest"
import { buildMeetingDetailModel } from "../application/queries"
import { normalizeDomainState } from "../application/services"
import type { LocalDate, Meeting, UUID } from "../domain"
import {
  buildMeetingDocument,
  createMeetingPdfBytes,
} from "../infrastructure/files/meeting-document-service"
import { createPortfolioTestSession, testIds } from "./test-data"

const meetingId = "f9000000-0000-4000-8000-000000000001" as UUID
const agendaId = "f9000000-0000-4000-8000-000000000002" as UUID

describe("agenda- en verslagdocumenten", () => {
  it("bouwt een gegroepeerde Outlook-kopie en geldige PDF", async () => {
    const session = createPortfolioTestSession()
    const records = structuredClone(session.state.records)
    const meeting: Meeting = {
      id: meetingId,
      type: "Projectoverleg",
      scopeType: "Project",
      scopeId: testIds.projectOne,
      title: "Werfoverleg toegang",
      date: "2026-08-16" as LocalDate,
      status: "Concept",
      audit: structuredClone(records.projects[0]!.audit),
    }
    records.meetings.push(meeting)
    records.agendaItems.push({
      id: agendaId,
      meetingId,
      order: 1,
      title: "TOP-001 · Toegang spoed",
      reason: "Besluit nodig",
      discussionStatus: "Te bespreken",
      objectType: "Topic",
      objectId: testIds.topicCritical,
      audit: structuredClone(records.projects[0]!.audit),
    })
    const model = buildMeetingDetailModel(
      normalizeDomainState(records),
      meetingId,
      "2026-08-16",
    )!
    const document = buildMeetingDocument(model, "agenda")
    const pdf = await createMeetingPdfBytes(document)

    expect(model.agendaGroups[0]).toMatchObject({
      chapter: { id: testIds.chapter },
      cluster: { id: testIds.cluster },
      project: { id: testIds.projectOne },
    })
    expect(document.html).toContain("Toegang spoed")
    expect(document.html).toContain("Besluit nodig")
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-")
  })

  it("houdt historisch losse agendapunten leesbaar maar gemarkeerd", () => {
    const session = createPortfolioTestSession()
    const records = structuredClone(session.state.records)
    records.meetings.push({
      id: meetingId,
      type: "Portfolio-overleg",
      scopeType: "Portfolio",
      title: "Historisch overleg",
      date: "2025-01-10" as LocalDate,
      status: "Definitief",
      audit: structuredClone(records.projects[0]!.audit),
    })
    records.agendaItems.push({
      id: agendaId,
      meetingId,
      order: 1,
      title: "Oude rondvraag",
      discussionStatus: "Besproken",
      audit: structuredClone(records.projects[0]!.audit),
    })
    const model = buildMeetingDetailModel(
      normalizeDomainState(records),
      meetingId,
      "2026-08-16",
    )!

    expect(model.agendaGroups[0]).toMatchObject({
      legacy: true,
      label: "Historische agendapunten zonder geldige bron",
    })
  })
})
