import { performance } from "node:perf_hooks"
import {
  buildActionListItems,
  buildBudgetPortfolioModel,
  buildDashboardModel,
  defaultGlobalPlanningFilters,
  buildGlobalSearchResults,
  buildPortfolioPlanningModel,
  buildPortfolioRows,
  buildProjectOverview,
} from "../src/application/queries"
import {
  createEmptyDomainCollections,
  normalizeDomainState,
} from "../src/application/services"
import type {
  AuditFields,
  DateTime,
  LocalDate,
  Topic,
  UUID,
} from "../src/domain"
import { validateDomainIntegrity } from "../src/application/services"
import { JsonDataFileGateway } from "../src/infrastructure/json"

let sequence = 1
const nextUuid = (): UUID =>
  `00000000-0000-4000-8000-${(sequence++).toString(16).padStart(12, "0")}` as UUID
const date = (value: string) => value as LocalDate
const dateTime = (value: string) => value as DateTime
const audit: AuditFields = {
  createdAt: dateTime("2026-08-09T09:00:00.000Z"),
  updatedAt: dateTime("2026-08-09T09:00:00.000Z"),
  active: true,
}

function measure<T>(name: string, operation: () => T) {
  const started = performance.now()
  const value = operation()
  return { name, durationMs: performance.now() - started, value }
}

function buildFixture() {
  const records = createEmptyDomainCollections()
  for (let actorIndex = 0; actorIndex < 100; actorIndex += 1) {
    records.actors.push({
      id: nextUuid(),
      type: "Intern",
      displayName: `Performanceactor ${actorIndex + 1}`,
      email: `actor${actorIndex + 1}@example.test`,
      organization: "Synthetische testorganisatie",
      active: true,
      audit,
    })
  }
  for (let chapterIndex = 0; chapterIndex < 10; chapterIndex += 1) {
    const chapterId = nextUuid()
    records.chapters.push({
      id: chapterId,
      code: `H-${chapterIndex + 1}`,
      title: `Hoofdstuk ${chapterIndex + 1}`,
      order: chapterIndex + 1,
      status: "Active",
      audit,
    })
    for (let clusterIndex = 0; clusterIndex < 5; clusterIndex += 1) {
      records.clusters.push({
        id: nextUuid(),
        chapterId,
        code: `CL-${chapterIndex + 1}-${clusterIndex + 1}`,
        title: `Cluster ${chapterIndex + 1}.${clusterIndex + 1}`,
        description: "Synthetische performancecluster",
        status: "Active",
        order: clusterIndex + 1,
        audit,
      })
    }
  }

  for (let projectIndex = 0; projectIndex < 500; projectIndex += 1) {
    const chapter = records.chapters[projectIndex % records.chapters.length]!
    const clusterOptions = records.clusters.filter(
      (cluster) => cluster.chapterId === chapter.id,
    )
    const projectId = nextUuid()
    records.projects.push({
      id: projectId,
      chapterId: chapter.id,
      ...(projectIndex % 7
        ? {
            clusterId: clusterOptions[projectIndex % clusterOptions.length]!.id,
          }
        : {}),
      code: `PRJ-${String(projectIndex + 1).padStart(4, "0")}`,
      title: `Performanceproject patiëntenzone ${projectIndex + 1}`,
      description: "Synthetisch project voor releaseprofiling.",
      status: projectIndex % 13 === 0 ? "Afgesloten" : "Uitvoering",
      phase: "Realisatie",
      site: `Campus ${(projectIndex % 4) + 1}`,
      coordinatorActorId: records.actors[projectIndex % 100]!.id,
      startDate: date("2026-01-01"),
      plannedEndDate: date("2027-12-31"),
      progressPercent: projectIndex % 101,
      audit,
    })

    for (let topicIndex = 0; topicIndex < 10; topicIndex += 1) {
      const topicId = nextUuid()
      const topic: Topic = {
        id: topicId,
        parentType: "Project" as const,
        projectId,
        code: `TOP-${projectIndex + 1}-${topicIndex + 1}`,
        title: `Performancetopic ${projectIndex + 1}.${topicIndex + 1}`,
        context: "Synthetische vaste context met façade en patiënt.",
        ownerActorId: records.actors[(projectIndex + topicIndex) % 100]!.id,
        priority:
          topicIndex === 0 ? ("Kritiek" as const) : ("Normaal" as const),
        status: "Open" as const,
        order: topicIndex + 1,
        audit,
      }
      records.topics.push(topic)

      for (let updateIndex = 0; updateIndex < 5; updateIndex += 1) {
        const updateId = nextUuid()
        records.updates.push({
          id: updateId,
          objectType: "Topic",
          objectId: topicId,
          type: updateIndex === 4 ? "Beslissing" : "Update",
          date: date(`2026-08-${String(updateIndex + 1).padStart(2, "0")}`),
          authorActorId: records.actors[(projectIndex + updateIndex) % 100]!.id,
          text: `Update ${updateIndex + 1} voor ${topic.code}`,
          audit,
        })
        if (updateIndex === 3) topic.currentUpdateId = updateId
      }
      for (let actionIndex = 0; actionIndex < 4; actionIndex += 1) {
        records.actions.push({
          id: nextUuid(),
          objectType: "Topic",
          objectId: topicId,
          code: `ACT-${projectIndex + 1}-${topicIndex + 1}-${actionIndex + 1}`,
          title: `Performanceactie ${actionIndex + 1}`,
          ownerActorId: records.actors[(projectIndex + actionIndex) % 100]!.id,
          deadline: date(actionIndex === 0 ? "2026-08-01" : "2026-12-31"),
          status: actionIndex === 3 ? "Afgerond" : "Open",
          priority: actionIndex === 0 ? "Hoog" : "Normaal",
          ...(actionIndex === 3 ? { completedAt: date("2026-08-08") } : {}),
          audit,
        })
      }
      for (let planningIndex = 0; planningIndex < 2; planningIndex += 1) {
        records.planning.push({
          id: nextUuid(),
          projectId,
          ...(planningIndex === 0 ? { topicId } : {}),
          kind: planningIndex === 0 ? "Topic" : "Custom",
          title: `Planning ${planningIndex + 1} voor ${topic.code}`,
          startDate: date("2026-08-01"),
          plannedEndDate: date("2026-12-31"),
          progressPercent: 30,
          status: "Op schema",
          isMilestone: false,
          order: planningIndex + 1,
          audit,
        })
      }
      const budgetFacts = [
        ["Goedgekeurd budget", "Goedgekeurd"],
        ["Raming", "Verwacht"],
        ["Contract", "Vastgelegd"],
        ["Factuur", "Gefactureerd"],
        ["Betaling", "Betaald"],
      ] as const
      for (const [budgetIndex, fact] of budgetFacts.entries()) {
        records.budgets.push({
          id: nextUuid(),
          projectId,
          topicId,
          category: `Categorie ${(topicIndex % 5) + 1}`,
          type: fact[0],
          description: `${fact[0]} voor ${topic.code}`,
          amountCents: 100_000 + budgetIndex * 10_000,
          date: date("2026-08-09"),
          status: fact[1],
          audit,
        })
      }
    }
  }

  for (let meetingIndex = 0; meetingIndex < 1_000; meetingIndex += 1) {
    records.meetings.push({
      id: nextUuid(),
      type: "Werfoverleg",
      scopeType: "Project",
      scopeId: records.projects[meetingIndex % 500]!.id,
      number: `OV-${meetingIndex + 1}`,
      title: `Performanceoverleg ${meetingIndex + 1}`,
      date: date("2026-08-09"),
      status: "Concept",
      audit,
    })
  }
  records.config.push({
    id: nextUuid(),
    schemaVersion: "1.0.0",
    dataSetId: nextUuid(),
    createdAt: dateTime("2026-08-09T09:00:00.000Z"),
    appVersion: "performance-audit",
    defaultCurrency: "EUR",
    currentActorId: records.actors[0]!.id,
    audit,
  })
  return records
}

async function main() {
  const fixture = measure("fixture-opbouw", buildFixture)
  const normalized = measure("indices-opbouwen", () =>
    normalizeDomainState(fixture.value),
  )
  const state = normalized.value
  const projectId = state.records.projects[499]!.id
  const measurements = [
    measure("portfolio-query", () => buildPortfolioRows(state, "2026-08-09")),
    measure("dashboard-query", () => buildDashboardModel(state, "2026-08-09")),
    measure("globaal-zoeken", () =>
      buildGlobalSearchResults(state, "TOP-500-10"),
    ),
    measure("project-openen", () =>
      buildProjectOverview(state, projectId, "2026-08-09"),
    ),
    measure("actie-query", () => buildActionListItems(state)),
    measure("portfolio-gantt", () =>
      buildPortfolioPlanningModel(
        state,
        defaultGlobalPlanningFilters,
        "2026-08-09",
      ),
    ),
    measure("budgetaggregatie", () => buildBudgetPortfolioModel(state)),
  ]

  const gateway = new JsonDataFileGateway()
  const validationIssues = validateDomainIntegrity(state.records)
  if (validationIssues.length) {
    console.error(JSON.stringify(validationIssues.slice(0, 20), null, 2))
    process.exitCode = 1
    return
  }
  const exportStarted = performance.now()
  const exported = gateway.export(state)
  const exportMs = performance.now() - exportStarted
  const importStarted = performance.now()
  const imported = await gateway.importText(
    exported.text,
    "performance-fixture.json",
  )
  const importMs = performance.now() - importStarted

  const counts = Object.fromEntries(
    Object.entries(state.records).map(([name, records]) => [
      name,
      records.length,
    ]),
  )
  const output = {
    generatedAt: new Date().toISOString(),
    counts,
    timingsMs: Object.fromEntries([
      [fixture.name, Number(fixture.durationMs.toFixed(1))],
      [normalized.name, Number(normalized.durationMs.toFixed(1))],
      ...measurements.map(({ name, durationMs }) => [
        name,
        Number(durationMs.toFixed(1)),
      ]),
      ["json-export", Number(exportMs.toFixed(1))],
      ["json-import", Number(importMs.toFixed(1))],
    ]),
    dataFileMegabytes: Number(
      (new TextEncoder().encode(exported.text).byteLength / 1_048_576).toFixed(
        2,
      ),
    ),
    heapMegabytes: Number(
      (process.memoryUsage().heapUsed / 1_048_576).toFixed(1),
    ),
    importBlockingIssues: imported.issues.filter(
      (issue) => issue.level === "Blocking",
    ).length,
    importedCountsMatch: Object.entries(counts).every(
      ([name, count]) =>
        imported.state.records[name as keyof typeof imported.state.records]
          .length === count,
    ),
  }
  console.log(JSON.stringify(output, null, 2))
  if (output.importBlockingIssues || !output.importedCountsMatch)
    process.exitCode = 1
}

await main()
