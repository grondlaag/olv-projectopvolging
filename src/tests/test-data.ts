import {
  normalizeDomainState,
  createEmptyDomainCollections,
  type DataFileSession,
} from "../application/services"
import type {
  Action,
  Actor,
  AuditFields,
  Chapter,
  Cluster,
  DateTime,
  LocalDate,
  PlanningEntry,
  Project,
  Topic,
  Update,
  UUID,
} from "../domain"

const uuid = (value: string) => value as UUID
const date = (value: string) => value as LocalDate
const dateTime = (value: string) => value as DateTime

export const testIds = {
  chapter: uuid("10000000-0000-4000-8000-000000000001"),
  cluster: uuid("20000000-0000-4000-8000-000000000001"),
  actorOne: uuid("30000000-0000-4000-8000-000000000001"),
  actorTwo: uuid("30000000-0000-4000-8000-000000000002"),
  projectOne: uuid("40000000-0000-4000-8000-000000000001"),
  projectTwo: uuid("40000000-0000-4000-8000-000000000002"),
  projectThree: uuid("40000000-0000-4000-8000-000000000003"),
  topicCritical: uuid("50000000-0000-4000-8000-000000000001"),
  topicNormal: uuid("50000000-0000-4000-8000-000000000002"),
  topicClosed: uuid("50000000-0000-4000-8000-000000000003"),
} as const

const auditDate = dateTime("2026-01-10T09:00:00.000Z")

function audit(actorId = testIds.actorOne): AuditFields {
  return {
    createdAt: auditDate,
    createdByActorId: actorId,
    updatedAt: auditDate,
    updatedByActorId: actorId,
    active: true,
  }
}

export function createPortfolioTestSession(): DataFileSession {
  const records = createEmptyDomainCollections()
  const chapter: Chapter = {
    id: testIds.chapter,
    code: "H1",
    title: "Gebouw en ruimte",
    order: 1,
    status: "Active",
    audit: audit(),
  }
  const cluster: Cluster = {
    id: testIds.cluster,
    chapterId: chapter.id,
    code: "CL-01",
    title: "Zorgcampus",
    description: "Synthetische cluster",
    status: "Active",
    order: 1,
    audit: audit(),
  }
  const actorOne: Actor = {
    id: testIds.actorOne,
    type: "Intern",
    displayName: "Anna Coördinator",
    active: true,
    audit: audit(),
  }
  const actorTwo: Actor = {
    id: testIds.actorTwo,
    type: "Intern",
    displayName: "Bram Beheerder",
    active: true,
    audit: audit(testIds.actorTwo),
  }
  const projects: Project[] = [
    {
      id: testIds.projectOne,
      chapterId: chapter.id,
      clusterId: cluster.id,
      code: "PRJ-001",
      title: "Renovatie verpleegafdeling",
      description: "Renovatie binnen de bestaande zorgcampus.",
      status: "Uitvoering",
      phase: "Realisatie",
      site: "Campus Noord",
      location: "Blok A",
      department: "Technische dienst",
      coordinatorActorId: actorOne.id,
      startDate: date("2025-05-01"),
      plannedEndDate: date("2026-09-30"),
      progressPercent: 45,
      audit: audit(),
    },
    {
      id: testIds.projectTwo,
      chapterId: chapter.id,
      code: "PRJ-002",
      title: "Afgeronde onthaalstudie",
      description: "Gesloten synthetisch project zonder cluster.",
      status: "Afgesloten",
      phase: "Nazorg",
      coordinatorActorId: actorOne.id,
      plannedEndDate: date("2025-12-31"),
      progressPercent: 100,
      audit: audit(),
    },
    {
      id: testIds.projectThree,
      chapterId: chapter.id,
      code: "PRJ-003",
      title: "Beleidsproject energie",
      description: "Open beleidsproject zonder cluster.",
      status: "Voorbereiding",
      phase: "Analyse",
      site: "Campus Zuid",
      department: "Directie",
      coordinatorActorId: actorTwo.id,
      plannedEndDate: date("2027-03-01"),
      progressPercent: 10,
      audit: audit(testIds.actorTwo),
    },
  ]
  const topics: Topic[] = [
    {
      id: testIds.topicCritical,
      parentType: "Project",
      projectId: testIds.projectOne,
      code: "TOP-001",
      title: "Toegang spoed",
      context: "Kritiek synthetisch topic",
      priority: "Kritiek",
      status: "Open",
      order: 1,
      audit: audit(),
    },
    {
      id: testIds.topicNormal,
      parentType: "Project",
      projectId: testIds.projectThree,
      code: "TOP-002",
      title: "Energiebeleid",
      context: "Normaal synthetisch topic",
      priority: "Normaal",
      status: "Open",
      order: 1,
      audit: audit(testIds.actorTwo),
    },
    {
      id: testIds.topicClosed,
      parentType: "Project",
      projectId: testIds.projectOne,
      code: "TOP-003",
      title: "Afgerond detail",
      context: "Gesloten topic",
      priority: "Laag",
      status: "Afgesloten",
      order: 2,
      audit: audit(),
    },
  ]
  const actions: Action[] = [
    {
      id: uuid("60000000-0000-4000-8000-000000000001"),
      objectType: "Project",
      objectId: testIds.projectOne,
      code: "ACT-001",
      title: "Achterstallige actie",
      ownerActorId: actorOne.id,
      deadline: date("2026-01-14"),
      status: "Open",
      priority: "Hoog",
      audit: audit(),
    },
    {
      id: uuid("60000000-0000-4000-8000-000000000002"),
      objectType: "Topic",
      objectId: testIds.topicCritical,
      code: "ACT-002",
      title: "Topicactie",
      ownerActorId: actorOne.id,
      deadline: date("2026-01-25"),
      status: "Bezig",
      priority: "Normaal",
      audit: audit(),
    },
    {
      id: uuid("60000000-0000-4000-8000-000000000003"),
      objectType: "Project",
      objectId: testIds.projectThree,
      code: "ACT-003",
      title: "Toekomstige actie",
      ownerActorId: actorTwo.id,
      deadline: date("2026-02-01"),
      status: "Open",
      priority: "Normaal",
      audit: audit(testIds.actorTwo),
    },
    {
      id: uuid("60000000-0000-4000-8000-000000000004"),
      objectType: "Project",
      objectId: testIds.projectOne,
      code: "ACT-004",
      title: "Afgeronde actie",
      ownerActorId: actorOne.id,
      status: "Afgerond",
      completedAt: date("2026-01-05"),
      priority: "Laag",
      audit: audit(),
    },
  ]
  const milestone: PlanningEntry = {
    id: uuid("70000000-0000-4000-8000-000000000001"),
    projectId: testIds.projectOne,
    kind: "Milestone",
    title: "Synthetische mijlpaal",
    plannedEndDate: date("2026-01-30"),
    status: "Niet gestart",
    isMilestone: true,
    order: 1,
    audit: audit(),
  }
  const decision: Update = {
    id: uuid("80000000-0000-4000-8000-000000000001"),
    objectType: "Project",
    objectId: testIds.projectOne,
    type: "Beslissing",
    date: date("2026-01-12"),
    authorActorId: actorOne.id,
    text: "De synthetische uitvoeringsvariant is goedgekeurd.",
    audit: audit(),
  }

  records.chapters.push(chapter)
  records.clusters.push(cluster)
  records.actors.push(actorOne, actorTwo)
  records.projects.push(...projects)
  records.topics.push(...topics)
  records.actions.push(...actions)
  records.planning.push(milestone)
  records.updates.push(decision)
  records.config.push({
    id: uuid("90000000-0000-4000-8000-000000000001"),
    schemaVersion: "1.0.0",
    dataSetId: uuid("90000000-0000-4000-8000-000000000002"),
    createdAt: auditDate,
    appVersion: "test",
    defaultCurrency: "EUR",
    currentActorId: actorOne.id,
    audit: audit(),
  })

  return {
    state: normalizeDomainState(records),
    fileName: "portfolio-test.json",
    schemaVersion: "1.0.0",
    format: "json",
    origin: "import",
    issues: [],
    hasBlockingIssues: false,
  }
}
