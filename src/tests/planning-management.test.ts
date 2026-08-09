// @vitest-environment node

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import {
  buildPortfolioPlanningModel,
  defaultGlobalPlanningFilters,
  isPlanningEntryDelayed,
} from "../application/queries"
import {
  normalizeDomainState,
  PlanningManagementError,
  PlanningManagementService,
  type PlanningEntryInput,
} from "../application/services"
import {
  hasPlanningDependencyCycle,
  type LocalDate,
  type UUID,
} from "../domain"
import { BrowserExcelWorkbookGateway } from "../infrastructure/excel"
import { createPortfolioTestSession, testIds } from "./test-data"

const service = new PlanningManagementService()
const now = new Date("2026-08-09T10:00:00.000Z")
let sequence = 0

function createUuid(): UUID {
  sequence += 1
  return `f6000000-0000-4000-8000-${String(sequence).padStart(12, "0")}` as UUID
}

function periodInput(
  patch: Partial<PlanningEntryInput> = {},
): PlanningEntryInput {
  return {
    projectId: testIds.projectOne,
    kind: "Custom",
    title: "Uitvoeringsperiode",
    startDate: "2026-08-10" as LocalDate,
    plannedEndDate: "2026-09-15" as LocalDate,
    progressPercent: 25,
    status: "Op schema",
    isMilestone: false,
    ...patch,
  }
}

beforeEach(() => {
  sequence = 0
})

describe("planningitems en topictiming", () => {
  it("ondersteunt een topic zonder planning en maakt precies één primaire entry", () => {
    const state = createPortfolioTestSession().state
    expect(
      state.indices.planningByTopic.get(testIds.topicCritical),
    ).toBeUndefined()

    const result = service.saveTopicTiming(
      state,
      testIds.topicCritical,
      {
        startDate: "2026-08-10" as LocalDate,
        plannedEndDate: "2026-09-01" as LocalDate,
        progressPercent: 10,
        status: "Op schema",
        isMilestone: false,
      },
      { now, createUuid },
    )

    expect(result.record).toMatchObject({
      topicId: testIds.topicCritical,
      projectId: testIds.projectOne,
      kind: "Topic",
      title: "Toegang spoed",
    })
    expect(
      result.state.indices.planningByTopic.get(testIds.topicCritical),
    ).toHaveLength(1)
  })

  it("weigert een tweede primaire planningentry voor hetzelfde topic", () => {
    const first = service.saveTopicTiming(
      createPortfolioTestSession().state,
      testIds.topicCritical,
      {
        startDate: "2026-08-10" as LocalDate,
        plannedEndDate: "2026-09-01" as LocalDate,
        progressPercent: 10,
        status: "Op schema",
        isMilestone: false,
      },
      { now, createUuid },
    )

    expect(() =>
      service.createEntry(
        first.state,
        periodInput({
          topicId: testIds.topicCritical,
          kind: "Topic",
          title: "Dubbele topicplanning",
        }),
        { now, createUuid },
      ),
    ).toThrow("Dit topic heeft al een primaire planningentry.")
  })

  it("maakt een duurloze mijlpaal met logische voortgang", () => {
    const result = service.createEntry(
      createPortfolioTestSession().state,
      {
        projectId: testIds.projectOne,
        kind: "Milestone",
        title: "Bevel van aanvang",
        plannedEndDate: "2026-10-01" as LocalDate,
        progressPercent: 0,
        status: "Niet gestart",
        isMilestone: true,
      },
      { now, createUuid },
    )

    expect(result.record.startDate).toBeUndefined()
    expect(result.record.progressPercent).toBe(0)
    expect(result.record.isMilestone).toBe(true)
  })

  it("maakt een geldige periode en weigert datum- en progressiefouten", () => {
    expect(
      service.createEntry(createPortfolioTestSession().state, periodInput(), {
        now,
        createUuid,
      }).record,
    ).toMatchObject({ startDate: "2026-08-10", progressPercent: 25 })

    expect(() =>
      service.createEntry(
        createPortfolioTestSession().state,
        periodInput({ plannedEndDate: "2026-08-09" as LocalDate }),
      ),
    ).toThrow(PlanningManagementError)
    expect(() =>
      service.createEntry(
        createPortfolioTestSession().state,
        periodInput({ progressPercent: 101 }),
      ),
    ).toThrow("Voortgang moet tussen 0 en 100 procent liggen.")
  })

  it("leidt vertraging af zonder de expliciete status te wijzigen", () => {
    const entry = {
      plannedEndDate: "2026-08-08" as LocalDate,
      status: "Op schema" as const,
    }
    expect(isPlanningEntryDelayed(entry, "2026-08-09")).toBe(true)
    expect(entry.status).toBe("Op schema")
    expect(
      isPlanningEntryDelayed({ ...entry, status: "Afgerond" }, "2026-08-09"),
    ).toBe(false)
  })
})

describe("finish-to-start-afhankelijkheden", () => {
  function entries() {
    const first = service.createEntry(
      createPortfolioTestSession().state,
      periodInput({ title: "Voorganger" }),
      { now, createUuid },
    )
    const second = service.createEntry(
      first.state,
      periodInput({ title: "Opvolger" }),
      { now, createUuid },
    )
    return { first, second }
  }

  it("maakt uitsluitend een geldige finish-to-start-koppeling", () => {
    const { first, second } = entries()
    const result = service.createDependency(
      second.state,
      {
        predecessorPlanningId: first.record.id,
        successorPlanningId: second.record.id,
      },
      { now, createUuid },
    )
    expect(result.record.type).toBe("FinishToStart")
  })

  it("weigert self- en cross-project-afhankelijkheden", () => {
    const { first, second } = entries()
    expect(() =>
      service.createDependency(second.state, {
        predecessorPlanningId: first.record.id,
        successorPlanningId: first.record.id,
      }),
    ).toThrow("Een planningitem kan niet van zichzelf afhangen.")

    const otherProject = service.createEntry(
      second.state,
      periodInput({ projectId: testIds.projectThree, title: "Ander project" }),
      { now, createUuid },
    )
    expect(() =>
      service.createDependency(otherProject.state, {
        predecessorPlanningId: first.record.id,
        successorPlanningId: otherProject.record.id,
      }),
    ).toThrow("Afhankelijkheden moeten binnen hetzelfde project blijven.")
  })

  it("detecteert een cyclus als pure domeinfunctie en weigert de mutatie", () => {
    const { first, second } = entries()
    const dependency = service.createDependency(
      second.state,
      {
        predecessorPlanningId: first.record.id,
        successorPlanningId: second.record.id,
      },
      { now, createUuid },
    )
    expect(
      hasPlanningDependencyCycle([
        dependency.record,
        {
          predecessorPlanningId: second.record.id,
          successorPlanningId: first.record.id,
        },
      ]),
    ).toBe(true)
    expect(() =>
      service.createDependency(dependency.state, {
        predecessorPlanningId: second.record.id,
        successorPlanningId: first.record.id,
      }),
    ).toThrow("Deze afhankelijkheid zou een cyclus in de planning maken.")
  })
})

describe("planning Excelroundtrip en schaal", () => {
  it("behoudt topictiming, mijlpaal, custom item, dependency, progress en status", async () => {
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
    const topicEntry = imported.state.records.planning.find(
      (entry) => entry.kind === "Topic",
    )!
    const updated = service.updateEntry(
      imported.state,
      topicEntry.id,
      {
        projectId: topicEntry.projectId,
        topicId: topicEntry.topicId!,
        kind: "Topic",
        title: topicEntry.title,
        startDate: topicEntry.startDate!,
        plannedEndDate: topicEntry.plannedEndDate,
        progressPercent: 63,
        status: "Risico",
        isMilestone: false,
      },
      { now, createUuid },
    )
    const custom = service.createEntry(
      updated.state,
      periodInput({
        projectId: topicEntry.projectId,
        title: "Tijdelijke logistieke zone",
        status: "Op schema",
      }),
      { now, createUuid },
    )
    const milestone = custom.state.records.planning.find(
      (entry) => entry.kind === "Milestone",
    )!
    const dependency = service.createDependency(
      custom.state,
      {
        predecessorPlanningId: milestone.id,
        successorPlanningId: custom.record.id,
      },
      { now, createUuid },
    )
    const exported = await gateway.export(dependency.state, sourceBuffer)
    const reimported = await gateway.importBuffer(
      exported.buffer,
      exported.fileName,
    )

    expect(reimported.hasBlockingIssues).toBe(false)
    expect(
      reimported.state.indices.planningById.get(topicEntry.id),
    ).toMatchObject({ progressPercent: 63, status: "Risico" })
    expect(
      reimported.state.indices.planningById.get(custom.record.id)?.title,
    ).toBe("Tijdelijke logistieke zone")
    expect(
      reimported.state.indices.planningById.get(milestone.id)?.isMilestone,
    ).toBe(true)
    expect(
      reimported.state.indices.planningDependencyById.get(dependency.record.id),
    ).toMatchObject({
      predecessorPlanningId: milestone.id,
      successorPlanningId: custom.record.id,
      type: "FinishToStart",
    })
  }, 30_000)

  it("bouwt de portfolioquery met de gedocumenteerde performancefixture zonder geneste GUID-scans", () => {
    const base = createPortfolioTestSession().state
    const records = structuredClone(base.records)
    records.projects = []
    records.planning = []
    for (let projectIndex = 0; projectIndex < 500; projectIndex += 1) {
      const projectId =
        `c0000000-0000-4000-8000-${String(projectIndex).padStart(12, "0")}` as UUID
      records.projects.push({
        ...base.records.projects[0]!,
        id: projectId,
        code: `PERF-${projectIndex}`,
      })
      for (let itemIndex = 0; itemIndex < 10; itemIndex += 1) {
        records.planning.push({
          ...base.records.planning[0]!,
          id: `d${String(projectIndex).padStart(7, "0")}-0000-4000-8000-${String(itemIndex).padStart(12, "0")}` as UUID,
          projectId,
          kind: "Custom",
          title: `Item ${itemIndex}`,
          startDate: "2026-01-01" as LocalDate,
          isMilestone: false,
          order: itemIndex + 1,
        })
      }
    }
    const state = normalizeDomainState(records)
    const started = performance.now()
    const model = buildPortfolioPlanningModel(
      state,
      defaultGlobalPlanningFilters,
      "2026-08-09",
    )
    const duration = performance.now() - started
    expect(
      model[0]?.clusters.flatMap((cluster) => cluster.projects),
    ).toHaveLength(500)
    expect(duration).toBeLessThan(2_500)
  })
})
