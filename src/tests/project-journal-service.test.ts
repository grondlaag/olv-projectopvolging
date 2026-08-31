import { describe, expect, it } from "vitest"
import {
  buildProjectJournalWorkspace,
  decisionRequestsForProject,
} from "../application/queries"
import {
  MeetingManagementService,
  normalizeDomainState,
  parseJournalCommand,
  ProjectJournalService,
  validateDomainIntegrity,
} from "../application/services"
import type { LocalDate, UUID } from "../domain"
import { createPortfolioTestSession, testIds } from "./test-data"

const service = new ProjectJournalService()
const meetingService = new MeetingManagementService()
const now = new Date("2026-02-10T10:00:00.000Z")
let sequence = 0
const createUuid = () =>
  `a0000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}` as UUID

describe("uniform projectjournaal", () => {
  it("projecteert acties, beslissingen en historiek in één chronologische stroom", () => {
    const state = createPortfolioTestSession().state
    const workspace = buildProjectJournalWorkspace(
      state,
      testIds.projectOne,
      "2026-01-01" as LocalDate,
    )!

    expect(workspace.activeTopics.map((item) => item.topic.id)).toEqual([
      testIds.topicCritical,
    ])
    expect(workspace.closedTopics.map((item) => item.topic.id)).toEqual([
      testIds.topicClosed,
    ])
    expect(workspace.activeTopics[0]?.openActions[0]?.content).toBe(
      "Topicactie",
    )
    expect(
      workspace.activeTopics[0]?.entries.map((entry) => entry.content),
    ).toEqual(["Topicactie"])
  })

  it("maakt alle entrytypes vanuit dezelfde composer en behoudt hun topiccontext", () => {
    sequence = 0
    let state = createPortfolioTestSession().state
    for (const value of [
      "Nieuwe stand van zaken",
      "/actie Controleer de toegang",
      "/besluit Toegang blijft tijdelijk gesloten",
    ]) {
      state = service.executeComposer(state, testIds.topicCritical, value, {
        now,
        createUuid,
      }).state
    }
    const topic = buildProjectJournalWorkspace(
      state,
      testIds.projectOne,
      "2026-02-10" as LocalDate,
    )!.activeTopics[0]!

    expect(
      topic.openActions.some(
        (item) => item.content === "Controleer de toegang",
      ),
    ).toBe(true)
    expect(
      topic.decisions.some(
        (item) => item.content === "Toegang blijft tijdelijk gesloten",
      ),
    ).toBe(true)
    expect(
      topic.history.some((item) => item.content === "Nieuwe stand van zaken"),
    ).toBe(true)
  })

  it("sluit een update traceerbaar af en kan ze opnieuw openen", () => {
    sequence = 0
    const added = service.addEntry(
      createPortfolioTestSession().state,
      testIds.topicCritical,
      "update",
      "Afsluitbare update",
      { now, createUuid },
    )
    const updateId = (added.record as { id: UUID }).id
    const closed = service.setUpdateCompleted(added.state, updateId, true, {
      now,
      createUuid,
    })
    expect(
      buildProjectJournalWorkspace(
        closed.state,
        testIds.projectOne,
        "2026-02-10" as LocalDate,
      )?.activeTopics[0]?.entries.find((entry) => entry.id === updateId)
        ?.completed,
    ).toBe(true)
    expect(
      closed.state.records.evidence.some(
        (item) => item.type === "JournalCompletion" && item.audit.active,
      ),
    ).toBe(true)

    const reopened = service.setUpdateCompleted(closed.state, updateId, false, {
      now,
      createUuid,
    })
    expect(
      buildProjectJournalWorkspace(
        reopened.state,
        testIds.projectOne,
        "2026-02-10" as LocalDate,
      )?.activeTopics[0]?.entries.find((entry) => entry.id === updateId)
        ?.completed,
    ).toBe(false)
  })

  it("bewaart overlegbijdragen als dezelfde projectjournaalobjecten met agendacontext", () => {
    sequence = 0
    const meeting = meetingService.createMeeting(
      createPortfolioTestSession().state,
      {
        type: "Projectoverleg",
        scopeType: "Project",
        scopeId: testIds.projectOne,
        title: "Werfoverleg",
        date: "2026-02-10" as LocalDate,
        status: "Concept",
        participants: [],
      },
      { now, createUuid },
    )
    const agenda = meetingService.saveAgendaItem(
      meeting.state,
      meeting.record.id,
      {
        title: "Tijdelijke toegang",
        discussionStatus: "Te bespreken",
        objectType: "Topic",
        objectId: testIds.topicCritical,
      },
      undefined,
      { now, createUuid },
    )
    let state = agenda.state
    for (const value of [
      "Stand vanuit het overleg",
      "/actie Controleer de toegang",
      "/besluit Variant A is goedgekeurd",
      "/beslissing-nodig Mag de toegang open?",
    ]) {
      state = service.executeMeetingComposer(state, agenda.record.id, value, {
        now,
        createUuid,
      }).state
    }

    const topic = buildProjectJournalWorkspace(
      state,
      testIds.projectOne,
      "2026-02-10" as LocalDate,
    )!.activeTopics.find((item) => item.topic.id === testIds.topicCritical)!
    const createdEntries = topic.entries.filter((entry) =>
      entry.meetingLinks.some((link) => link.agendaItemId === agenda.record.id),
    )

    expect(createdEntries.map((entry) => entry.type).sort()).toEqual([
      "action",
      "decision",
      "decision_request",
      "update",
    ])
    expect(state.indices.updatesByMeeting.get(meeting.record.id)).toHaveLength(
      2,
    )
    expect(state.indices.actionsByMeeting.get(meeting.record.id)).toHaveLength(
      1,
    )
    expect(
      state.records.evidence
        .filter((item) => item.type === "MeetingLink")
        .map((item) => JSON.parse(item.description ?? "{}")),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meetingId: meeting.record.id,
          agendaItemId: agenda.record.id,
          meetingDate: "2026-02-10",
        }),
      ]),
    )
    const report = meetingService.saveDraftReport(state, meeting.record.id, {
      now,
      createUuid,
    })
    const reportItems =
      report.state.indices.reportItemsByReport.get(report.record.id) ?? []
    expect(reportItems.map((item) => item.section)).toEqual(
      expect.arrayContaining([
        "Updates",
        "Beslissingen",
        "Acties",
        "Beslissingsvragen",
      ]),
    )
    expect(
      reportItems.some((item) => item.titleSnapshot === "Mag de toegang open?"),
    ).toBe(true)
    expect(validateDomainIntegrity(state.records)).toEqual([])
  })

  it("wisselt een update naar een actie en registreert de typehistoriek", () => {
    sequence = 0
    const initial = createPortfolioTestSession().state
    const added = service.addEntry(
      initial,
      testIds.topicCritical,
      "update",
      "Nog te behandelen punt",
      { now, createUuid },
    )
    const id = (added.record as { id: UUID }).id
    const converted = service.convertEntry(added.state, id, "action", {
      now,
      createUuid,
    })

    const convertedId = (converted.record as { id: UUID }).id
    expect(convertedId).not.toBe(id)
    expect(
      converted.state.indices.actionById.get(convertedId)?.audit.active,
    ).toBe(true)
    expect(converted.state.indices.updateById.get(id)?.audit.active).toBe(false)
    expect(converted.state.records.evidence.at(-1)).toMatchObject({
      objectType: "Action",
      objectId: convertedId,
      type: "JournalHistory",
      title: "type changed",
    })
    expect(
      converted.state.indices.actionById.get(convertedId)?.audit.createdAt,
    ).toBe(added.state.indices.updateById.get(id)?.audit.createdAt)
    expect(validateDomainIntegrity(converted.state.records)).toEqual([])
  })

  it("bewaart en resolveert een beslissingsvraag zonder nieuw JSON-recordtype", () => {
    sequence = 0
    const initial = createPortfolioTestSession().state
    const added = service.addDecisionRequest(
      initial,
      testIds.projectOne,
      "Topic",
      testIds.topicCritical,
      "Mag de spoedtoegang open?",
      [testIds.actorTwo],
      "2026-02-15" as LocalDate,
      { now, createUuid },
    )
    expect(
      decisionRequestsForProject(added.state, testIds.projectOne)[0],
    ).toMatchObject({
      question: "Mag de spoedtoegang open?",
      status: "pending",
    })
    expect(
      buildProjectJournalWorkspace(
        added.state,
        testIds.projectOne,
        "2026-02-10" as LocalDate,
      )?.activeTopics[0]?.entries[0]?.type,
    ).toBe("decision_request")

    const resolved = service.resolveDecisionRequest(
      added.state,
      added.record!.id,
      testIds.topicCritical,
      "De toegang mag open.",
      { now, createUuid },
    )
    expect(
      decisionRequestsForProject(resolved.state, testIds.projectOne)[0]?.status,
    ).toBe("decided")
  })

  it("ondersteunt de afgesproken Nederlandstalige slashcommando's", () => {
    expect(parseJournalCommand("/actie Bel aannemer")).toMatchObject({
      name: "action",
      content: "Bel aannemer",
    })
    expect(parseJournalCommand("/sluit").name).toBe("close")
    expect(parseJournalCommand("/update Stand van zaken").name).toBe("update")
    expect(parseJournalCommand("/beslissing Akkoord").name).toBe("decision")
    expect(parseJournalCommand("/beslissing-nodig Akkoord nodig").name).toBe(
      "decision_request",
    )
    expect(parseJournalCommand("Gewone tekst").name).toBe("update")
  })

  it("maakt oplopende T-nummers zonder oude nummers te hergebruiken", () => {
    sequence = 0
    const initial = createPortfolioTestSession().state
    const first = service.createTopic(
      initial,
      testIds.projectOne,
      "Nieuw detail",
      {
        now,
        createUuid,
      },
    )
    const second = service.createTopic(
      first.state,
      testIds.projectOne,
      "Nog een detail",
      {
        now: new Date("2026-02-11T10:00:00.000Z"),
        createUuid,
      },
    )

    expect(first.record?.code).toBe("T-004")
    expect(second.record?.code).toBe("T-005")
    expect(
      buildProjectJournalWorkspace(
        second.state,
        testIds.projectOne,
        "2026-02-11" as LocalDate,
      )
        ?.activeTopics.slice(0, 2)
        .map((item) => item.topic.code),
    ).toEqual(["T-005", "T-004"])
  })

  it("koppelt dezelfde entry aan meerdere overleggen zonder duplicaatdata", () => {
    sequence = 0
    const initial = createPortfolioTestSession().state
    const meetings = [
      {
        id: createUuid(),
        type: "Bouwoverleg",
        scopeType: "Project" as const,
        scopeId: testIds.projectOne,
        title: "Bouwoverleg 03/09",
        date: "2026-09-03" as LocalDate,
        status: "Concept" as const,
        audit: initial.records.projects[0]!.audit,
      },
      {
        id: createUuid(),
        type: "Directie",
        scopeType: "Project" as const,
        scopeId: testIds.projectOne,
        title: "Directie 05/09",
        date: "2026-09-05" as LocalDate,
        status: "Concept" as const,
        audit: initial.records.projects[0]!.audit,
      },
    ]
    let state = normalizeDomainState({
      ...initial.records,
      meetings: [...initial.records.meetings, ...meetings],
    })
    const added = service.addEntry(
      state,
      testIds.topicCritical,
      "update",
      "Bespreek dit detail",
      { now, createUuid },
    )
    state = added.state
    const entryId = (added.record as { id: UUID }).id
    for (const meeting of meetings) {
      state = service.linkToMeeting(
        state,
        testIds.projectOne,
        testIds.topicCritical,
        "Update",
        entryId,
        meeting.id,
        { now, createUuid },
      ).state
    }

    const entry = buildProjectJournalWorkspace(
      state,
      testIds.projectOne,
      "2026-02-10" as LocalDate,
    )?.activeTopics[0]?.entries.find((item) => item.id === entryId)
    expect(entry?.meetingLinks.map((link) => link.meeting?.title)).toEqual([
      "Bouwoverleg 03/09",
      "Directie 05/09",
    ])
    expect(
      state.records.evidence.filter(
        (item) => item.type === "MeetingLink" && item.objectId === entryId,
      ),
    ).toHaveLength(2)
  })
})
