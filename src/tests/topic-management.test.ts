// @vitest-environment node

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import {
  buildProjectJournal,
  buildProjectJournalGroups,
  buildTopicListItems,
  defaultTopicFilters,
  filterTopicListItems,
} from "../application/queries"
import {
  TopicManagementError,
  TopicManagementService,
  normalizeDomainState,
  validateTopicCurrentUpdate,
  type TopicInput,
} from "../application/services"
import type { LocalDate, UUID } from "../domain"
import { BrowserExcelWorkbookGateway } from "../infrastructure/excel"
import { createPortfolioTestSession, testIds } from "./test-data"

const service = new TopicManagementService()
const now = new Date("2026-08-09T12:00:00.000Z")
let idCounter = 0

function createUuid(): UUID {
  idCounter += 1
  return `d0000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}` as UUID
}

function projectTopicInput(patch: Partial<TopicInput> = {}): TopicInput {
  return {
    parentType: "Project",
    projectId: testIds.projectOne,
    code: "TOP-F4",
    title: "Fase 4 topic",
    context: "Vaste synthetische context.",
    ownerActorId: testIds.actorOne,
    priority: "Hoog",
    ...patch,
  }
}

beforeEach(() => {
  idCounter = 0
})

describe("topicbeheer", () => {
  it("archiveert een topic zonder de gekoppelde historie te wissen", () => {
    const session = createPortfolioTestSession()
    const beforeUpdates = session.state.records.updates.length
    const result = service.archiveTopic(session.state, testIds.topicCritical, {
      now,
    })

    expect(result.record).toMatchObject({
      status: "Geannuleerd",
      audit: { active: false },
    })
    expect(result.state.records.updates).toHaveLength(beforeUpdates)
    expect(
      buildTopicListItems(result.state, "Project", testIds.projectOne).some(
        (item) => item.topic.id === testIds.topicCritical,
      ),
    ).toBe(false)
  })
  it("maakt een projecttopic met stabiele UUID en exact één projectouder", () => {
    const result = service.createTopic(
      createPortfolioTestSession().state,
      projectTopicInput(),
      { now, createUuid },
    )

    expect(result.record.id).toBe("d0000000-0000-4000-8000-000000000001")
    expect(result.record).toMatchObject({
      parentType: "Project",
      projectId: testIds.projectOne,
      status: "Open",
    })
    expect(result.record.clusterId).toBeUndefined()
    expect(
      result.state.indices.topicsByProject.get(testIds.projectOne),
    ).toContainEqual(result.record)
  })

  it("maakt een clustertopic met exact één clusterouder", () => {
    const result = service.createTopic(
      createPortfolioTestSession().state,
      {
        parentType: "Cluster",
        clusterId: testIds.cluster,
        code: "CL-TOP-F4",
        title: "Fase 4 clustertopic",
        context: "Vaste clustercontext.",
        ownerActorId: testIds.actorOne,
        priority: "Hoog",
      },
      { now, createUuid },
    )

    expect(result.record).toMatchObject({
      parentType: "Cluster",
      clusterId: testIds.cluster,
    })
    expect(result.record.projectId).toBeUndefined()
    expect(result.state.indices.topicsByCluster.get(testIds.cluster)).toEqual([
      result.record,
    ])
  })

  it("bewerkt alle topickerngegevens zonder ouder of historiek te wijzigen", () => {
    const session = createPortfolioTestSession()
    const before = session.state.indices.topicById.get(testIds.topicCritical)!
    const historyCount = session.state.records.updates.length
    const result = service.updateTopic(
      session.state,
      before.id,
      projectTopicInput({
        code: "TOP-GEWIJZIGD",
        title: "Gewijzigde topictitel",
        context: "Bijgewerkte vaste context.",
        ownerActorId: testIds.actorTwo,
        priority: "Kritiek",
      }),
      { now },
    )

    expect(result.record).toMatchObject({
      id: before.id,
      parentType: "Project",
      projectId: testIds.projectOne,
      code: "TOP-GEWIJZIGD",
      title: "Gewijzigde topictitel",
      context: "Bijgewerkte vaste context.",
      ownerActorId: testIds.actorTwo,
      priority: "Kritiek",
      status: before.status,
    })
    expect(result.record.currentUpdateId).toBe(before.currentUpdateId)
    expect(result.state.records.updates).toHaveLength(historyCount)
    expect(() =>
      service.updateTopic(result.state, before.id, {
        parentType: "Cluster",
        clusterId: testIds.cluster,
        code: "TOP-VERPLAATS",
        title: "Verplaatsing is niet toegestaan",
        context: "Context",
        priority: "Normaal",
      }),
    ).toThrow("De project- of clustercontext")
  })

  it("weigert twee ouders en een inactieve eigenaar", () => {
    const session = createPortfolioTestSession()
    const records = structuredClone(session.state.records)
    records.actors[0]!.active = false
    const state = {
      ...session.state,
      records,
      indices: {
        ...session.state.indices,
        actorById: new Map(records.actors.map((actor) => [actor.id, actor])),
      },
    }

    expect(() =>
      service.createTopic(
        state,
        projectTopicInput({ clusterId: testIds.cluster }),
        { now, createUuid },
      ),
    ).toThrowError(TopicManagementError)
    expect(() =>
      service.createTopic(state, projectTopicInput(), { now, createUuid }),
    ).toThrow("De eigenaar moet een actieve actor zijn.")
  })

  it("voegt een actuele update toe zonder eerdere bijdragen te overschrijven", () => {
    const topic = service.createTopic(
      createPortfolioTestSession().state,
      projectTopicInput(),
      { now, createUuid },
    )
    const first = service.addJournalEntry(
      topic.state,
      topic.record.id,
      {
        type: "Notitie",
        date: "2026-08-09" as LocalDate,
        text: "Eerste historische notitie.",
      },
      { now, createUuid },
    )
    const current = service.addJournalEntry(
      first.state,
      topic.record.id,
      {
        type: "Update",
        date: "2026-08-10" as LocalDate,
        text: "Dit is de actuele stand.",
        makeCurrent: true,
      },
      { now: new Date("2026-08-10T12:00:00Z"), createUuid },
    )
    const updatedTopic = current.state.indices.topicById.get(topic.record.id)!

    expect(current.state.records.updates).toEqual(
      expect.arrayContaining([first.record, current.record]),
    )
    expect(updatedTopic.currentUpdateId).toBe(current.record.id)
    expect(validateTopicCurrentUpdate(current.state, updatedTopic)).toBe(true)

    const invalidRecords = structuredClone(current.state.records)
    invalidRecords.updates.find(
      (entry) => entry.id === current.record.id,
    )!.audit.active = false
    const invalidState = normalizeDomainState(invalidRecords)
    expect(
      validateTopicCurrentUpdate(
        invalidState,
        invalidState.indices.topicById.get(topic.record.id)!,
      ),
    ).toBe(false)
  })

  it("scheidt de gekozen auteur van de huidige auditactor", () => {
    const topic = service.createTopic(
      createPortfolioTestSession().state,
      projectTopicInput(),
      { now, createUuid },
    )
    const contribution = service.addJournalEntry(
      topic.state,
      topic.record.id,
      {
        authorActorId: testIds.actorTwo,
        type: "Update",
        date: "2026-08-09" as LocalDate,
        text: "Bijdrage geschreven door een andere actieve actor.",
      },
      { now, createUuid },
    )

    expect(contribution.record.authorActorId).toBe(testIds.actorTwo)
    expect(contribution.record.audit.createdByActorId).toBe(testIds.actorOne)
  })

  it("houdt een beslissing apart van de actuele stand", () => {
    const topic = service.createTopic(
      createPortfolioTestSession().state,
      projectTopicInput(),
      { now, createUuid },
    )
    const current = service.addJournalEntry(
      topic.state,
      topic.record.id,
      {
        type: "Update",
        date: "2026-08-09" as LocalDate,
        text: "Actuele stand.",
        makeCurrent: true,
      },
      { now, createUuid },
    )
    const decision = service.addJournalEntry(
      current.state,
      topic.record.id,
      {
        type: "Beslissing",
        date: "2026-08-10" as LocalDate,
        text: "De variant is goedgekeurd.",
      },
      { now, createUuid },
    )

    expect(decision.record.type).toBe("Beslissing")
    expect(
      decision.state.indices.topicById.get(topic.record.id)?.currentUpdateId,
    ).toBe(current.record.id)
  })

  it("sluit, annuleert en heropent zonder historie te verwijderen", () => {
    const topic = service.createTopic(
      createPortfolioTestSession().state,
      projectTopicInput(),
      { now, createUuid },
    )
    const closed = service.setTopicStatus(
      topic.state,
      topic.record.id,
      "Afgesloten",
      { now, createUuid },
    )
    const reopened = service.setTopicStatus(
      closed.state,
      topic.record.id,
      "Open",
      { now: new Date("2026-08-10T12:00:00Z"), createUuid },
    )

    expect(closed.record.status).toBe("Afgesloten")
    expect(reopened.record.status).toBe("Open")
    expect(reopened.record.id).toBe(topic.record.id)
    expect(reopened.state.records.topics).toHaveLength(4)
  })
})

describe("topicselecties", () => {
  it("filtert op zoeken, status, eigenaar en prioriteit via geïndexeerde modellen", () => {
    const state = createPortfolioTestSession().state
    const items = buildTopicListItems(state, "Project", testIds.projectOne)

    expect(items).toHaveLength(2)
    expect(
      filterTopicListItems(items, {
        ...defaultTopicFilters,
        search: "toegang",
        status: "Open",
        ownerActorId: "",
        priority: "Kritiek",
      }).map((item) => item.topic.id),
    ).toEqual([testIds.topicCritical])
    expect(items[0]).toMatchObject({ actionCount: 1, openActionCount: 1 })
  })

  it("combineert project- en topicbijdragen newest-first in het projectjournaal", () => {
    const state = createPortfolioTestSession().state
    const topic = state.indices.topicById.get(testIds.topicCritical)!
    const contribution = service.addJournalEntry(
      state,
      topic.id,
      {
        type: "Update",
        date: "2026-01-13" as LocalDate,
        text: "Topicbijdrage voor het projectjournaal.",
      },
      { now, createUuid },
    )
    const journal = buildProjectJournal(contribution.state, testIds.projectOne)

    expect(journal.map((entry) => entry.sourceType)).toEqual([
      "Topic",
      "Project",
    ])
    const groups = buildProjectJournalGroups(
      contribution.state,
      testIds.projectOne,
    )
    expect(groups[0]).toMatchObject({
      kind: "project",
      title: "Algemene projectopvolging",
    })
    expect(groups.find((group) => group.topic?.id === topic.id)).toMatchObject({
      kind: "topic",
      updates: [
        expect.objectContaining({
          text: "Topicbijdrage voor het projectjournaal.",
        }),
      ],
    })
  })
})

describe("fase-4 Excelroundtrip", () => {
  it("behoudt projecttopic, actuele update, beslissing en afgesloten status", async () => {
    const fixturePath = resolve(
      process.cwd(),
      "src/tests/fixtures/excel/small-valid.xlsx",
    )
    const bytes = await readFile(fixturePath)
    const sourceBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer
    const gateway = new BrowserExcelWorkbookGateway()
    const imported = await gateway.importBuffer(
      sourceBuffer,
      "small-valid.xlsx",
    )
    const projectId = imported.state.records.projects[0]!.id
    const ownerActorId = imported.state.records.actors.find(
      (actor) => actor.active && actor.audit.active,
    )!.id
    const topic = service.createTopic(
      imported.state,
      projectTopicInput({ projectId, ownerActorId }),
      { now, createUuid },
    )
    const current = service.addJournalEntry(
      topic.state,
      topic.record.id,
      {
        type: "Update",
        date: "2026-08-09" as LocalDate,
        text: "Actuele roundtripstand.",
        makeCurrent: true,
      },
      { now, createUuid },
    )
    const decision = service.addJournalEntry(
      current.state,
      topic.record.id,
      {
        type: "Beslissing",
        date: "2026-08-10" as LocalDate,
        text: "Roundtripbeslissing.",
      },
      { now, createUuid },
    )
    const closed = service.setTopicStatus(
      decision.state,
      topic.record.id,
      "Afgesloten",
      { now, createUuid },
    )

    const exported = await gateway.export(closed.state, sourceBuffer)
    const reimported = await gateway.importBuffer(
      exported.buffer,
      exported.fileName,
    )
    const roundTrippedTopic = reimported.state.indices.topicById.get(
      topic.record.id,
    )!

    expect(reimported.hasBlockingIssues).toBe(false)
    expect(roundTrippedTopic.status).toBe("Afgesloten")
    expect(roundTrippedTopic.currentUpdateId).toBe(current.record.id)
    expect(
      reimported.state.indices.updatesByObject
        .get(`Topic:${topic.record.id}`)
        ?.map((entry) => entry.type),
    ).toEqual(["Update", "Beslissing"])
    expect(
      validateTopicCurrentUpdate(reimported.state, roundTrippedTopic),
    ).toBe(true)
  }, 30_000)
})
