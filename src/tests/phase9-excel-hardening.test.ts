// @vitest-environment node

import { describe, expect, it } from "vitest"
import {
  cloneDomainCollections,
  compareDomainStates,
  normalizeDomainState,
} from "../application/services"
import type { AuditFields, DateTime, LocalDate, UUID } from "../domain"
import { BrowserExcelWorkbookGateway } from "../infrastructure/excel"
import { createPortfolioTestSession, testIds } from "./test-data"

const uuid = (value: string) => value as UUID
const date = (value: string) => value as LocalDate
const dateTime = (value: string) => value as DateTime
const audit: AuditFields = {
  createdAt: dateTime("2026-08-09T09:00:00.000Z"),
  createdByActorId: testIds.actorOne,
  updatedAt: dateTime("2026-08-09T10:15:00.000Z"),
  updatedByActorId: testIds.actorOne,
  active: true,
}

describe("fase 9 volledige Excel-hardening", () => {
  it("behoudt alle records, Unicode, datums, booleans, cents, volgorde en relaties semantisch", async () => {
    const records = cloneDomainCollections(
      createPortfolioTestSession().state.records,
    )
    const historyId = uuid("91000000-0000-4000-8000-000000000001")
    const updateId = uuid("91000000-0000-4000-8000-000000000002")
    const actionId = uuid("91000000-0000-4000-8000-000000000003")
    const actionHistoryId = uuid("91000000-0000-4000-8000-000000000004")
    const evidenceId = uuid("91000000-0000-4000-8000-000000000005")
    const planningId = uuid("91000000-0000-4000-8000-000000000006")
    const dependencyId = uuid("91000000-0000-4000-8000-000000000007")
    const budgetId = uuid("91000000-0000-4000-8000-000000000008")
    const mutationId = uuid("91000000-0000-4000-8000-000000000009")
    const meetingId = uuid("91000000-0000-4000-8000-000000000010")
    const participantId = uuid("91000000-0000-4000-8000-000000000011")
    const agendaId = uuid("91000000-0000-4000-8000-000000000012")
    const reportId = uuid("91000000-0000-4000-8000-000000000013")
    const reportItemId = uuid("91000000-0000-4000-8000-000000000014")
    const choiceId = uuid("91000000-0000-4000-8000-000000000015")
    const logId = uuid("91000000-0000-4000-8000-000000000016")

    records.projectClusterHistory.push({
      id: historyId,
      projectId: testIds.projectOne,
      clusterId: testIds.cluster,
      validFrom: date("2026-01-01"),
      reason: "Historiek façade en patiëntenzone",
      authorActorId: testIds.actorOne,
      audit,
    })
    records.updates.push({
      id: updateId,
      objectType: "Topic",
      objectId: testIds.topicCritical,
      meetingId,
      type: "Overlegbijdrage",
      date: date("2026-08-09"),
      authorActorId: testIds.actorOne,
      text: `Actuele stand met Unicode: patiënt, façade, € en ✓. ${"Lange inhoud ".repeat(40)}`,
      audit,
    })
    records.topics.find(
      (topic) => topic.id === testIds.topicCritical,
    )!.currentUpdateId = updateId
    records.actions.push({
      id: actionId,
      objectType: "Topic",
      objectId: testIds.topicCritical,
      sourceMeetingId: meetingId,
      code: "ACT-UNICODE",
      title: "Controleer façade vóór oplevering",
      description: "Behoud optionele tekst en de koppeling naar overleg.",
      ownerActorId: testIds.actorOne,
      deadline: date("2026-09-30"),
      status: "Bezig",
      priority: "Hoog",
      audit,
    })
    records.actionHistory.push({
      id: actionHistoryId,
      actionId,
      changedAt: dateTime("2026-08-09T10:00:00.000Z"),
      changedByActorId: testIds.actorOne,
      field: "status",
      previousValue: "Open",
      newValue: "Bezig",
      reason: "Besproken in overleg",
      audit,
    })
    records.evidence.push({
      id: evidenceId,
      objectType: "Topic",
      objectId: testIds.topicCritical,
      type: "Document",
      title: "Technische nota façade",
      description: "Lokale referentie zonder upload of netwerkverkeer.",
      urlOrReference: "Dossier/Nota-09",
      date: date("2026-08-08"),
      authorActorId: testIds.actorOne,
      audit,
    })
    records.planning.push({
      id: planningId,
      projectId: testIds.projectOne,
      topicId: testIds.topicCritical,
      kind: "Topic",
      title: "Oplevering patiëntenzone",
      startDate: date("2026-08-15"),
      plannedEndDate: date("2026-10-31"),
      progressPercent: 37,
      status: "Op schema",
      isMilestone: false,
      order: 9,
      audit,
    })
    records.planningDependencies.push({
      id: dependencyId,
      predecessorPlanningId: records.planning[0]!.id,
      successorPlanningId: planningId,
      type: "FinishToStart",
      audit,
    })
    records.budgets.push({
      id: budgetId,
      projectId: testIds.projectOne,
      topicId: testIds.topicCritical,
      category: "Façade & technieken",
      type: "Meerwerk",
      description: "Gekoppeld bedrag wordt één keer geaggregeerd.",
      amountCents: 12_345_678,
      date: date("2026-08-09"),
      status: "Vastgelegd",
      reference: "BW-€-009",
      supplierActorId: testIds.actorTwo,
      audit,
    })
    records.budgetMutations.push({
      id: mutationId,
      budgetRecordId: budgetId,
      changeType: "Correctie van fout",
      deltaCents: -100,
      previousAmountCents: 12_345_778,
      newAmountCents: 12_345_678,
      reason: "Afrondingsfout van één euro gecorrigeerd.",
      date: date("2026-08-10"),
      authorActorId: testIds.actorOne,
      audit,
    })
    records.meetings.push({
      id: meetingId,
      type: "Werfoverleg",
      scopeType: "Project",
      scopeId: testIds.projectOne,
      number: "OV-2026-09",
      title: "Werfoverleg patiëntenzone",
      date: date("2026-08-09"),
      chairActorId: testIds.actorOne,
      reporterActorId: testIds.actorTwo,
      status: "Definitief",
      nextMeetingDate: date("2026-08-23"),
      audit,
    })
    records.meetingParticipants.push({
      id: participantId,
      meetingId,
      actorId: testIds.actorOne,
      role: "Voorzitter",
      attended: true,
      audit,
    })
    records.agendaItems.push({
      id: agendaId,
      meetingId,
      order: 7,
      title: "Façadebeslissing",
      reason: "Budget en timing samen beoordelen.",
      notes: "Besproken met alle aanwezigen.",
      objectType: "Topic",
      objectId: testIds.topicCritical,
      discussionStatus: "Besproken",
      audit,
    })
    records.reports.push({
      id: reportId,
      meetingId,
      version: 3,
      status: "Definitief",
      draftDate: date("2026-08-09"),
      finalDate: date("2026-08-10"),
      authorActorId: testIds.actorTwo,
      pdfReference: "Verslagen/OV-2026-09-v3.pdf",
      audit,
    })
    records.reportItems.push({
      id: reportItemId,
      reportId,
      order: 7,
      section: "Beslissingen",
      contentType: "Beslissing",
      objectType: "Topic",
      objectId: testIds.topicCritical,
      titleSnapshot: "Façadebeslissing — definitief",
      textSnapshot: "Historische snapshot blijft ongewijzigd na bronwijziging.",
      audit,
    })
    records.choiceLists.push({
      id: choiceId,
      listKey: "test-fase-9",
      valueKey: "unicode",
      label: "Patiëntenzone — façade",
      order: 4,
      system: false,
      active: true,
      audit,
    })
    records.log.push({
      id: logId,
      level: "Info",
      message: "Volledige release-roundtrip uitgevoerd.",
      objectType: "Project",
      objectId: testIds.projectOne,
      occurredAt: dateTime("2026-08-09T10:15:00.000Z"),
      audit,
    })

    const state = normalizeDomainState(records)
    const gateway = new BrowserExcelWorkbookGateway()
    const exported = await gateway.export(state)
    const reimported = await gateway.importBuffer(
      exported.buffer,
      "fase-9-volledige-roundtrip.xlsx",
    )

    expect(exported.issues).toEqual([])
    expect(reimported.hasBlockingIssues).toBe(false)
    expect(compareDomainStates(state, reimported.state)).toEqual({
      equal: true,
      differences: [],
    })
    expect(reimported.state.indices.budgetById.get(budgetId)?.amountCents).toBe(
      12_345_678,
    )
    expect(
      reimported.state.indices.meetingsByProject.get(testIds.projectOne),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: meetingId })]),
    )
    expect(
      reimported.state.indices.reportsByMeeting.get(meetingId)?.[0],
    ).toMatchObject({
      id: reportId,
      version: 3,
      status: "Definitief",
    })
    expect(
      reimported.state.indices.reportItemsByReport.get(reportId)?.[0],
    ).toMatchObject({
      order: 7,
      titleSnapshot: "Façadebeslissing — definitief",
    })
  }, 30_000)
})
