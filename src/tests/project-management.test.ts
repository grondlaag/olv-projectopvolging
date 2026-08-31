// @vitest-environment node

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import {
  ProjectManagementError,
  ProjectManagementService,
  normalizeDomainState,
  validateDomainIntegrity,
  type ProjectInput,
} from "../application/services"
import type { Chapter, LocalDate, UUID } from "../domain"
import { BrowserExcelWorkbookGateway } from "../infrastructure/excel"
import { JsonDataFileGateway } from "../infrastructure/json"
import { createPortfolioTestSession, testIds } from "./test-data"

const service = new ProjectManagementService()
const now = new Date("2026-08-09T12:00:00.000Z")
let idCounter = 0

function createUuid(): UUID {
  idCounter += 1
  return `a0000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}` as UUID
}

function projectInput(patch: Partial<ProjectInput> = {}): ProjectInput {
  return {
    code: "PRJ-100",
    title: "Nieuw synthetisch project",
    description: "Project voor fase 3.",
    chapterId: testIds.chapter,
    status: "Voorbereiding",
    phase: "Ontwerp",
    startDate: "2026-08-10" as LocalDate,
    plannedEndDate: "2027-01-31" as LocalDate,
    progressPercent: 5,
    ...patch,
  }
}

function stateWithClusterAgenda(status: "Concept" | "Definitief") {
  const records = structuredClone(createPortfolioTestSession().state.records)
  const otherChapter: Chapter = {
    ...records.chapters[0]!,
    id: "b0000000-0000-4000-8000-000000000010" as UUID,
    code: "H2",
    title: "Technieken",
  }
  const targetCluster = {
    ...records.clusters[0]!,
    id: "b0000000-0000-4000-8000-000000000011" as UUID,
    chapterId: otherChapter.id,
    code: "CL-H2",
    title: "Cluster technieken",
  }
  const meetingId = "b0000000-0000-4000-8000-000000000012" as UUID
  records.chapters.push(otherChapter)
  records.clusters.push(targetCluster)
  records.meetings.push({
    id: meetingId,
    type: "Projectoverleg",
    scopeType: "Cluster",
    scopeId: testIds.cluster,
    title: "Overleg oude cluster",
    date: "2026-08-10" as LocalDate,
    status,
    audit: records.projects[0]!.audit,
  })
  records.agendaItems.push({
    id: "b0000000-0000-4000-8000-000000000013" as UUID,
    meetingId,
    order: 1,
    objectType: "Project",
    objectId: testIds.projectOne,
    title: "Project bespreken",
    discussionStatus: status === "Concept" ? "Te bespreken" : "Besproken",
    audit: records.projects[0]!.audit,
  })
  return {
    state: normalizeDomainState(records),
    otherChapter,
    targetCluster,
  }
}

beforeEach(() => {
  idCounter = 0
})

describe("projectbeheer en clusterhistoriek", () => {
  it("maakt een volwaardig project zonder cluster en zonder fake historiek", () => {
    const result = service.createProject(
      createPortfolioTestSession().state,
      projectInput(),
      { now, createUuid },
    )

    expect(result.record.clusterId).toBeUndefined()
    expect(result.state.indices.projectById.get(result.record.id)).toBe(
      result.record,
    )
    expect(result.state.records.projectClusterHistory).toHaveLength(0)
  })

  it("maakt bij een nieuw project met cluster één open historyrecord", () => {
    const result = service.createProject(
      createPortfolioTestSession().state,
      projectInput({ clusterId: testIds.cluster }),
      { now, createUuid },
    )

    expect(result.state.records.projectClusterHistory).toEqual([
      expect.objectContaining({
        projectId: result.record.id,
        clusterId: testIds.cluster,
        validFrom: "2026-08-09",
      }),
    ])
    expect(
      result.state.records.projectClusterHistory[0]?.validTo,
    ).toBeUndefined()
  })

  it("weigert een cluster uit een ander hoofdstuk", () => {
    const session = createPortfolioTestSession()
    const otherChapter: Chapter = {
      ...session.state.records.chapters[0]!,
      id: "b0000000-0000-4000-8000-000000000001" as UUID,
      code: "H2",
      title: "Technieken",
    }
    const records = structuredClone(session.state.records)
    records.chapters.push(otherChapter)
    const state = normalizeDomainState(records)

    expect(() =>
      service.createProject(
        state,
        projectInput({
          chapterId: otherChapter.id,
          clusterId: testIds.cluster,
        }),
        { now, createUuid },
      ),
    ).toThrowError(ProjectManagementError)
  })

  it("voegt cluster en actor alleen bij hun expliciete save toe", () => {
    const original = createPortfolioTestSession().state
    const clusterResult = service.createCluster(
      original,
      {
        chapterId: testIds.chapter,
        code: "CL-NEW",
        title: "Nieuwe cluster",
        description: "Compact aangemaakt",
      },
      { now, createUuid },
    )
    const actorResult = service.createActor(
      clusterResult.state,
      {
        displayName: "Nieuwe Coördinator",
        type: "Intern",
        email: "coordinator@example.test",
        organization: "OLV Test",
        role: "Projectcoördinator",
        active: true,
      },
      { now, createUuid },
    )

    expect(original.records.clusters).toHaveLength(1)
    expect(
      clusterResult.state.indices.clusterById.get(clusterResult.record.id),
    ).toBeDefined()
    expect(
      actorResult.state.indices.actorById.get(actorResult.record.id),
    ).toMatchObject({
      displayName: "Nieuwe Coördinator",
      active: true,
    })
  })

  it("wijzigt projectvelden zonder de project-ID te vervangen", () => {
    const state = createPortfolioTestSession().state
    const existing = state.indices.projectById.get(testIds.projectOne)!
    const result = service.updateProject(
      state,
      existing.id,
      projectInput({
        code: existing.code,
        title: "Gewijzigde projecttitel",
        clusterId: existing.clusterId!,
      }),
      { now, createUuid },
    )

    expect(result.record.id).toBe(existing.id)
    expect(result.record.title).toBe("Gewijzigde projecttitel")
  })

  it("sluit de open koppeling en opent een nieuwe bij clusterwijziging", () => {
    const state = createPortfolioTestSession().state
    const first = service.createProject(
      state,
      projectInput({ clusterId: testIds.cluster }),
      { now, createUuid },
    )
    const secondCluster = service.createCluster(
      first.state,
      {
        chapterId: testIds.chapter,
        code: "CL-02",
        title: "Tweede cluster",
      },
      { now: new Date("2026-08-10T12:00:00Z"), createUuid },
    )
    const changed = service.updateProject(
      secondCluster.state,
      first.record.id,
      projectInput({ clusterId: secondCluster.record.id }),
      { now: new Date("2026-08-11T12:00:00Z"), createUuid },
    )
    const history = changed.state.indices.projectClusterHistoryByProject.get(
      first.record.id,
    )!

    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({
      clusterId: testIds.cluster,
      validTo: "2026-08-11",
    })
    expect(history[1]).toMatchObject({ clusterId: secondCluster.record.id })
    expect(history[1]?.validTo).toBeUndefined()
    expect(history.filter((item) => !item.validTo)).toHaveLength(1)
  })

  it("sluit de huidige koppeling zonder fake record wanneer cluster wordt verwijderd", () => {
    const first = service.createProject(
      createPortfolioTestSession().state,
      projectInput({ clusterId: testIds.cluster }),
      { now, createUuid },
    )
    const changed = service.updateProject(
      first.state,
      first.record.id,
      projectInput(),
      { now: new Date("2026-08-12T12:00:00Z"), createUuid },
    )

    expect(changed.record.clusterId).toBeUndefined()
    expect(changed.state.records.projectClusterHistory).toHaveLength(1)
    expect(changed.state.records.projectClusterHistory[0]?.validTo).toBe(
      "2026-08-12",
    )
  })

  it("migreert vrij naar een cluster in een ander hoofdstuk en blijft exporteerbaar", async () => {
    const session = createPortfolioTestSession()
    const records = structuredClone(session.state.records)
    const otherChapter: Chapter = {
      ...records.chapters[0]!,
      id: "b0000000-0000-4000-8000-000000000002" as UUID,
      code: "H2",
      title: "Technieken",
    }
    records.chapters.push(otherChapter)
    const initial = normalizeDomainState(records)
    const created = service.createProject(
      initial,
      projectInput({ clusterId: testIds.cluster }),
      { now, createUuid },
    )
    const targetCluster = service.createCluster(
      created.state,
      {
        chapterId: otherChapter.id,
        code: "CL-H2",
        title: "Cluster technieken",
      },
      { now: new Date("2026-08-10T12:00:00Z"), createUuid },
    )
    const migrated = service.updateProject(
      targetCluster.state,
      created.record.id,
      projectInput({
        chapterId: otherChapter.id,
        clusterId: targetCluster.record.id,
      }),
      { now: new Date("2026-08-11T12:00:00Z"), createUuid },
    )

    expect(migrated.record).toMatchObject({
      chapterId: otherChapter.id,
      clusterId: targetCluster.record.id,
    })
    const history =
      migrated.state.indices.projectClusterHistoryByProject.get(
        migrated.record.id,
      ) ?? []
    expect(history).toEqual([
      expect.objectContaining({
        clusterId: testIds.cluster,
        validTo: "2026-08-11",
      }),
      expect.objectContaining({
        clusterId: targetCluster.record.id,
      }),
    ])
    expect(history[1]?.validTo).toBeUndefined()
    expect(validateDomainIntegrity(migrated.state.records)).toEqual([])

    const invalidRecords = structuredClone(migrated.state.records)
    delete invalidRecords.projectClusterHistory[0]!.validTo
    expect(
      validateDomainIntegrity(invalidRecords).map((issue) => issue.code),
    ).toContain("data.history.open-cluster-mismatch")

    const gateway = new JsonDataFileGateway()
    const exported = gateway.export(migrated.state)
    const reopened = await gateway.importText(exported.text, exported.fileName)
    expect(reopened.hasBlockingIssues).toBe(false)
    expect(
      reopened.state.indices.projectById.get(migrated.record.id),
    ).toMatchObject({
      chapterId: otherChapter.id,
      clusterId: targetCluster.record.id,
    })
  })

  it("blokkeert migratie zolang het project op een conceptagenda van de oude cluster staat", () => {
    const { state, otherChapter, targetCluster } =
      stateWithClusterAgenda("Concept")

    expect(() =>
      service.updateProject(
        state,
        testIds.projectOne,
        projectInput({
          chapterId: otherChapter.id,
          clusterId: targetCluster.id,
        }),
        { now, createUuid },
      ),
    ).toThrow("staat nog op de agenda van een conceptoverleg")
  })

  it("behoudt een definitieve overlegagenda als historische context na migratie", () => {
    const { state, otherChapter, targetCluster } =
      stateWithClusterAgenda("Definitief")

    const migrated = service.updateProject(
      state,
      testIds.projectOne,
      projectInput({
        chapterId: otherChapter.id,
        clusterId: targetCluster.id,
      }),
      { now, createUuid },
    )

    expect(migrated.record).toMatchObject({
      chapterId: otherChapter.id,
      clusterId: targetCluster.id,
    })
    expect(validateDomainIntegrity(migrated.state.records)).toEqual([])
    expect(migrated.state.records.agendaItems).toHaveLength(1)
  })

  it("weigert een inactieve projectcoördinator", () => {
    const actor = service.createActor(
      createPortfolioTestSession().state,
      { displayName: "Inactief", type: "Intern", active: false },
      { now, createUuid },
    )
    expect(() =>
      service.createProject(
        actor.state,
        projectInput({ coordinatorActorId: actor.record.id }),
        { now, createUuid },
      ),
    ).toThrow("De projectcoördinator moet een actieve actor zijn.")
  })
})

describe("fase-3 Excelroundtrip", () => {
  it("behoudt nieuw project, cluster, actor en historie na export en herimport", async () => {
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
    const cluster = service.createCluster(
      imported.state,
      {
        chapterId: imported.state.records.chapters[0]!.id,
        code: "CL-F3",
        title: "Fase 3 cluster",
      },
      { now, createUuid },
    )
    const actor = service.createActor(
      cluster.state,
      {
        displayName: "Fase 3 actor",
        type: "Intern",
        email: "fase3@example.test",
        organization: "OLV Test",
        role: "Coördinator",
        active: true,
      },
      { now, createUuid },
    )
    const project = service.createProject(
      actor.state,
      projectInput({
        chapterId: imported.state.records.chapters[0]!.id,
        clusterId: cluster.record.id,
        coordinatorActorId: actor.record.id,
      }),
      { now, createUuid },
    )

    const exported = await gateway.export(project.state, sourceBuffer)
    const reimported = await gateway.importBuffer(
      exported.buffer,
      exported.fileName,
    )

    expect(
      reimported.issues.filter((issue) => issue.level === "Blocking"),
    ).toEqual([])
    expect(
      reimported.state.indices.projectById.get(project.record.id),
    ).toMatchObject({
      clusterId: cluster.record.id,
      coordinatorActorId: actor.record.id,
    })
    expect(
      reimported.state.indices.clusterById.get(cluster.record.id)?.title,
    ).toBe("Fase 3 cluster")
    expect(
      reimported.state.indices.actorById.get(actor.record.id)?.displayName,
    ).toBe("Fase 3 actor")
    const history = reimported.state.indices.projectClusterHistoryByProject.get(
      project.record.id,
    )
    expect(history).toEqual([
      expect.objectContaining({ clusterId: cluster.record.id }),
    ])
    expect(history?.[0]?.validTo).toBeUndefined()
  }, 30_000)
})
