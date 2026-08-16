// @vitest-environment node

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import {
  buildAgendaSchedulingModel,
  buildAgendaSuggestions,
  buildMeetingDetailModel,
  meetingsForProject,
} from "../application/queries"
import {
  ActionManagementService,
  compareDomainStates,
  MeetingManagementError,
  MeetingManagementService,
  normalizeDomainState,
  UpdateManagementService,
  type AgendaItemInput,
  type MeetingInput,
} from "../application/services"
import type { LocalDate, UUID } from "../domain"
import {
  BrowserExcelWorkbookGateway,
  ExcelReferentialValidator,
} from "../infrastructure/excel"
import { createPortfolioTestSession, testIds } from "./test-data"

const service = new MeetingManagementService()
const updateService = new UpdateManagementService()
const actionService = new ActionManagementService()
const now = new Date("2026-08-09T10:00:00.000Z")
let sequence = 0

function createUuid(): UUID {
  sequence += 1
  return `f8000000-0000-4000-8000-${String(sequence).padStart(12, "0")}` as UUID
}

function meetingInput(patch: Partial<MeetingInput> = {}): MeetingInput {
  return {
    type: "Projectoverleg",
    scopeType: "Project",
    scopeId: testIds.projectOne,
    number: "OV-2026-01",
    title: "Fase 8 projectoverleg",
    date: "2026-08-10" as LocalDate,
    chairActorId: testIds.actorOne,
    reporterActorId: testIds.actorTwo,
    status: "Concept",
    nextMeetingDate: "2026-09-10" as LocalDate,
    participants: [
      { actorId: testIds.actorOne, role: "Voorzitter", attended: false },
      { actorId: testIds.actorTwo, role: "Verslaggever", attended: false },
    ],
    ...patch,
  }
}

beforeEach(() => {
  sequence = 0
})

describe("overlegscope en deelnemers", () => {
  it.each([
    ["Portfolio", undefined],
    ["Hoofdstuk", testIds.chapter],
    ["Cluster", testIds.cluster],
    ["Project", testIds.projectOne],
  ] as const)("maakt een conceptoverleg met %s-scope", (scopeType, scopeId) => {
    const input = meetingInput({ scopeType })
    if (scopeId) input.scopeId = scopeId
    else delete input.scopeId
    const result = service.createMeeting(
      createPortfolioTestSession().state,
      input,
      { now, createUuid },
    )

    expect(result.record).toMatchObject({ scopeType, status: "Concept" })
    expect(result.record.scopeId).toBe(scopeId)
    expect(
      result.state.indices.meetingParticipantsByMeeting.get(result.record.id),
    ).toHaveLength(2)
  })

  it("weigert een scope van het verkeerde type en dubbele deelnemers", () => {
    expect(() =>
      service.createMeeting(
        createPortfolioTestSession().state,
        meetingInput({
          scopeType: "Cluster",
          scopeId: testIds.projectOne,
          participants: [
            { actorId: testIds.actorOne, attended: false },
            { actorId: testIds.actorOne, attended: false },
          ],
        }),
      ),
    ).toThrow(MeetingManagementError)
  })

  it("registreert aanwezigheid zonder een vrije tekstdeelnemer te maken", () => {
    const created = service.createMeeting(
      createPortfolioTestSession().state,
      meetingInput(),
      { now, createUuid },
    )
    const participant = created.state.indices.meetingParticipantsByMeeting.get(
      created.record.id,
    )![0]!
    const attended = service.setParticipantAttendance(
      created.state,
      participant.id,
      true,
      { now, createUuid },
    )

    expect(attended.record.attended).toBe(true)
    expect(attended.record.actorId).toBe(testIds.actorOne)
  })
})

describe("agenda, suggesties en volgorde", () => {
  it("weigert een nieuw los agendapunt zonder project- of topicbron", () => {
    const meeting = service.createMeeting(
      createPortfolioTestSession().state,
      meetingInput(),
      { now, createUuid },
    )
    expect(() =>
      service.saveAgendaItem(meeting.state, meeting.record.id, {
        title: "Losse rondvraag",
        discussionStatus: "Te bespreken",
      } as AgendaItemInput),
    ).toThrow("Koppel een agendapunt aan een project of topic.")
  })

  it("ondersteunt alleen relevante project- en topicagendapunten", () => {
    const meeting = service.createMeeting(
      createPortfolioTestSession().state,
      meetingInput(),
      { now, createUuid },
    )
    const projectPoint = service.saveAgendaItem(
      meeting.state,
      meeting.record.id,
      {
        title: "Projectopening",
        reason: "Vaste start van het overleg",
        discussionStatus: "Te bespreken",
        objectType: "Project",
        objectId: testIds.projectOne,
      },
      undefined,
      { now, createUuid },
    )
    const linked = service.saveAgendaItem(
      projectPoint.state,
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

    expect(
      linked.state.indices.agendaItemsByMeeting
        .get(meeting.record.id)
        ?.map((item) => item.order),
    ).toEqual([1, 2])
    expect(linked.record.objectId).toBe(testIds.topicCritical)
  })

  it("weigert een topic buiten projectscope", () => {
    const meeting = service.createMeeting(
      createPortfolioTestSession().state,
      meetingInput(),
      { now, createUuid },
    )
    expect(() =>
      service.saveAgendaItem(meeting.state, meeting.record.id, {
        title: "Verkeerd projecttopic",
        discussionStatus: "Te bespreken",
        objectType: "Topic",
        objectId: testIds.topicNormal,
      }),
    ).toThrow("Het gekozen record valt buiten de scope van dit overleg.")
  })

  it("toont geldige overlegkeuzes en voorkomt een dubbele bron op dezelfde agenda", () => {
    const meeting = service.createMeeting(
      createPortfolioTestSession().state,
      meetingInput(),
      { now, createUuid },
    )
    const before = buildAgendaSchedulingModel(
      meeting.state,
      "Topic",
      testIds.topicCritical,
      "2026-08-09" as LocalDate,
    )
    expect(before.availableMeetings).toContainEqual(meeting.record)

    const linked = service.saveAgendaItem(
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
    const after = buildAgendaSchedulingModel(
      linked.state,
      "Topic",
      testIds.topicCritical,
      "2026-08-09" as LocalDate,
    )

    expect(after.availableMeetings).not.toContainEqual(meeting.record)
    expect(after.scheduledMeetings[0]).toMatchObject({
      meeting: { id: meeting.record.id },
      agendaItem: { objectId: testIds.topicCritical },
    })
    expect(() =>
      service.saveAgendaItem(linked.state, meeting.record.id, {
        title: "Duplicaat",
        discussionStatus: "Te bespreken",
        objectType: "Topic",
        objectId: testIds.topicCritical,
      }),
    ).toThrow("Dit record staat al op de agenda van dit overleg.")
  })

  it("verplaatst agendapunten met expliciete omhoog/omlaag-volgorde", () => {
    const meeting = service.createMeeting(
      createPortfolioTestSession().state,
      meetingInput(),
      { now, createUuid },
    )
    const first = service.saveAgendaItem(
      meeting.state,
      meeting.record.id,
      {
        title: "Eerste",
        discussionStatus: "Te bespreken",
        objectType: "Project",
        objectId: testIds.projectOne,
      },
      undefined,
      { now, createUuid },
    )
    const second = service.saveAgendaItem(
      first.state,
      meeting.record.id,
      {
        title: "Tweede",
        discussionStatus: "Te bespreken",
        objectType: "Topic",
        objectId: testIds.topicCritical,
      },
      undefined,
      { now, createUuid },
    )
    const moved = service.moveAgendaItem(second.state, second.record.id, "up", {
      now,
      createUuid,
    })

    expect(
      [...moved.state.indices.agendaItemsByMeeting.get(meeting.record.id)!]
        .sort((left, right) => left.order - right.order)
        .map((item) => item.title),
    ).toEqual(["Tweede", "Eerste"])
  })

  it("stelt kritieke topics en broncontexten met acties voor", () => {
    const meeting = service.createMeeting(
      createPortfolioTestSession().state,
      meetingInput(),
      { now, createUuid },
    )
    const records = structuredClone(meeting.state.records)
    records.actions[0]!.status = "Wacht op beslissing"
    const state = normalizeDomainState(records)
    const suggestions = buildAgendaSuggestions(
      state,
      meeting.record,
      "2026-01-20",
    )

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectId: testIds.topicCritical }),
        expect.objectContaining({
          objectType: "Project",
          objectId: records.actions[0]!.objectId,
        }),
      ]),
    )
  })
})

describe("verwerking, bronrecords en rapporthistoriek", () => {
  function processedMeeting() {
    const meeting = service.createMeeting(
      createPortfolioTestSession().state,
      meetingInput(),
      { now, createUuid },
    )
    const agenda = service.saveAgendaItem(
      meeting.state,
      meeting.record.id,
      {
        title: "Tijdelijke toegang",
        notes: "Veiligheidszone besproken.",
        discussionStatus: "Besproken",
        objectType: "Topic",
        objectId: testIds.topicCritical,
      },
      undefined,
      { now, createUuid },
    )
    const update = updateService.addUpdate(
      agenda.state,
      {
        objectType: "Topic",
        objectId: testIds.topicCritical,
        meetingId: meeting.record.id,
        type: "Update",
        date: "2026-08-10" as LocalDate,
        text: "Actuele stand vanuit het overleg.",
        makeCurrent: true,
      },
      { now, createUuid },
    )
    const decision = updateService.addUpdate(
      update.state,
      {
        objectType: "Topic",
        objectId: testIds.topicCritical,
        meetingId: meeting.record.id,
        type: "Beslissing",
        date: "2026-08-10" as LocalDate,
        text: "De veiligheidsvariant is goedgekeurd.",
      },
      { now, createUuid },
    )
    const action = actionService.createAction(
      decision.state,
      {
        objectType: "Topic",
        objectId: testIds.topicCritical,
        sourceMeetingId: meeting.record.id,
        title: "Werkzone afbakenen",
        ownerActorId: testIds.actorOne,
        deadline: "2026-08-20" as LocalDate,
        status: "Open",
        priority: "Hoog",
      },
      { now, createUuid },
    )
    return { meeting, agenda, update, decision, action }
  }

  it("toont dezelfde update, beslissing en actie in overleg- en brondossier", () => {
    const { meeting, update, decision, action } = processedMeeting()
    const state = action.state

    expect(state.indices.updatesByMeeting.get(meeting.record.id)).toEqual([
      update.record,
      decision.record,
    ])
    expect(
      state.indices.updatesByObject.get(`Topic:${testIds.topicCritical}`),
    ).toEqual(expect.arrayContaining([update.record, decision.record]))
    expect(state.indices.actionsByMeeting.get(meeting.record.id)).toEqual([
      action.record,
    ])
    expect(
      state.indices.actionsByObject.get(`Topic:${testIds.topicCritical}`),
    ).toContainEqual(action.record)
  })

  it("bevriest een definitief verslag als snapshots en blokkeert inhoudsmutaties", () => {
    const { meeting, action } = processedMeeting()
    const draft = service.saveDraftReport(action.state, meeting.record.id, {
      now,
      createUuid,
    })
    const finalized = service.finalizeReport(draft.state, meeting.record.id, {
      now,
      createUuid,
    })
    const snapshots = finalized.state.indices.reportItemsByReport.get(
      finalized.record.id,
    )!

    expect(finalized.record).toMatchObject({
      version: 1,
      status: "Definitief",
      finalDate: "2026-08-09",
    })
    expect(snapshots.some((item) => item.section === "Beslissingen")).toBe(true)
    expect(
      snapshots.some(
        (item) =>
          item.section === "Acties" && item.contentType === "Anna Coördinator",
      ),
    ).toBe(true)
    expect(() =>
      service.saveAgendaItem(finalized.state, meeting.record.id, {
        title: "Te late wijziging",
        discussionStatus: "Te bespreken",
        objectType: "Project",
        objectId: testIds.projectOne,
      }),
    ).toThrow("Dit overleg is definitief")

    const renamedRecords = structuredClone(finalized.state.records)
    renamedRecords.topics.find(
      (topic) => topic.id === testIds.topicCritical,
    )!.title = "Nieuwe brontitel"
    const renamed = normalizeDomainState(renamedRecords)
    expect(
      renamed.indices.reportItemsByReport
        .get(finalized.record.id)
        ?.some((item) => item.titleSnapshot.includes("Tijdelijke toegang")),
    ).toBe(true)
  })

  it("bouwt een conceptverslag met de overlegverslaggever zonder huidige actor", () => {
    const { meeting, action } = processedMeeting()
    const records = structuredClone(action.state.records)
    delete records.config[0]!.currentActorId
    const state = normalizeDomainState(records)

    const draft = service.saveDraftReport(state, meeting.record.id, {
      now,
      createUuid,
    })

    expect(draft.record.authorActorId).toBe(meeting.record.reporterActorId)
    expect(draft.record.status).toBe("Concept")
  })

  it("maakt een nieuwe integer verslagversie en behoudt versie 1 intact", () => {
    const { meeting, action } = processedMeeting()
    const finalized = service.finalizeReport(action.state, meeting.record.id, {
      now,
      createUuid,
    })
    const previousItems = structuredClone(
      finalized.state.indices.reportItemsByReport.get(finalized.record.id),
    )
    const revision = service.createRevision(
      finalized.state,
      meeting.record.id,
      "Naam van de uitvoerder gecorrigeerd; geen nieuw overlegfeit.",
      { now: new Date("2026-08-11T10:00:00Z"), createUuid },
    )

    expect(revision.record).toMatchObject({ version: 2, status: "Gereviseerd" })
    expect(
      revision.state.indices.reportItemsByReport.get(finalized.record.id),
    ).toEqual(previousItems)
    expect(
      revision.state.indices.reportItemsByReport.get(revision.record.id)?.[0],
    ).toMatchObject({ section: "Revisie", contentType: "Correctie" })
  })

  it("blokkeert dubbele verslagversies aan de Excel-importgrens", () => {
    const { meeting, action } = processedMeeting()
    const finalized = service.finalizeReport(action.state, meeting.record.id, {
      now,
      createUuid,
    })
    const records = structuredClone(finalized.state.records)
    records.reports.push({
      ...finalized.record,
      id: createUuid(),
    })

    expect(
      new ExcelReferentialValidator()
        .validate(records)
        .map((issue) => issue.code),
    ).toContain("excel.report.duplicate-version")
  })

  it("bouwt dossier, acties per persoon en projectkoppeling uit indices", () => {
    const { meeting, action } = processedMeeting()
    const model = buildMeetingDetailModel(
      action.state,
      meeting.record.id,
      "2026-08-10",
    )!

    expect(model.agenda).toHaveLength(1)
    expect(model.updates).toHaveLength(1)
    expect(model.decisions).toHaveLength(1)
    expect(model.actionOwnerGroups[0]?.owner?.id).toBe(testIds.actorOne)
    expect(meetingsForProject(action.state, testIds.projectOne)).toContainEqual(
      meeting.record,
    )
  })
})

describe("fase-8 Excelroundtrip", () => {
  it("behoudt overleg, deelnemers, agenda, verslagitems, links en versies", async () => {
    const bytes = await readFile(
      resolve(process.cwd(), "src/tests/fixtures/excel/small-valid.xlsx"),
    )
    const source = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer
    const gateway = new BrowserExcelWorkbookGateway()
    const imported = await gateway.importBuffer(source, "small-valid.xlsx")
    const project = imported.state.records.projects[0]!
    const topic = imported.state.records.topics.find(
      (item) => item.projectId === project.id,
    )!
    const actor = imported.state.records.actors[0]!
    const meeting = service.createMeeting(
      imported.state,
      meetingInput({
        scopeId: project.id,
        chairActorId: actor.id,
        reporterActorId: actor.id,
        participants: [
          {
            actorId: actor.id,
            role: "Voorzitter en verslaggever",
            attended: true,
          },
        ],
      }),
      { now, createUuid },
    )
    const agenda = service.saveAgendaItem(
      meeting.state,
      meeting.record.id,
      {
        title: "Roundtrip agendapunt",
        reason: "Volledige overlegcontracttest",
        notes: "Deze notitie moet als snapshot terugkomen.",
        discussionStatus: "Besproken",
        objectType: "Topic",
        objectId: topic.id,
      },
      undefined,
      { now, createUuid },
    )
    const decision = updateService.addUpdate(
      agenda.state,
      {
        objectType: "Topic",
        objectId: topic.id,
        meetingId: meeting.record.id,
        type: "Beslissing",
        date: "2026-08-10" as LocalDate,
        text: "Roundtripbeslissing vanuit overleg.",
      },
      { now, createUuid },
    )
    const action = actionService.createAction(
      decision.state,
      {
        objectType: "Topic",
        objectId: topic.id,
        sourceMeetingId: meeting.record.id,
        title: "Roundtrip overlegactie",
        ownerActorId: actor.id,
        status: "Open",
        priority: "Normaal",
      },
      { now, createUuid },
    )
    const final = service.finalizeReport(action.state, meeting.record.id, {
      now,
      createUuid,
    })
    const revision = service.createRevision(
      final.state,
      meeting.record.id,
      "Synthetische correctie op versie 1.",
      { now: new Date("2026-08-11T10:00:00Z"), createUuid },
    )
    const exported = await gateway.export(revision.state, source)
    const reimported = await gateway.importBuffer(
      exported.buffer,
      exported.fileName,
    )

    expect(reimported.hasBlockingIssues).toBe(false)
    expect(compareDomainStates(revision.state, reimported.state)).toEqual({
      equal: true,
      differences: [],
    })
    expect(
      reimported.state.indices.meetingParticipantsByMeeting.get(
        meeting.record.id,
      ),
    ).toHaveLength(1)
    expect(
      reimported.state.indices.agendaItemsByMeeting.get(meeting.record.id)?.[0],
    ).toMatchObject({
      reason: "Volledige overlegcontracttest",
      notes: "Deze notitie moet als snapshot terugkomen.",
      discussionStatus: "Besproken",
    })
    expect(
      reimported.state.indices.reportsByMeeting
        .get(meeting.record.id)
        ?.map((report) => report.version),
    ).toEqual([1, 2])
    expect(
      reimported.state.indices.updatesByMeeting.get(meeting.record.id),
    ).toHaveLength(1)
    expect(
      reimported.state.indices.actionsByMeeting.get(meeting.record.id),
    ).toHaveLength(1)
  }, 30_000)
})
