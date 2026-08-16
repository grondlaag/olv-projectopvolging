import { describe, expect, it } from "vitest"
import {
  buildDashboardModel,
  buildPortfolioRows,
  defaultPortfolioFilters,
  filterPortfolioRows,
  groupPortfolioRows,
} from "../application/queries"
import { createPortfolioTestSession, testIds } from "./test-data"

const today = "2026-01-15"

describe("portfolioqueries", () => {
  const session = createPortfolioTestSession()
  const rows = buildPortfolioRows(session.state, today)

  it("groepeert projecten als hoofdstuk, cluster en zonder cluster", () => {
    const groups = groupPortfolioRows(rows)

    expect(groups).toHaveLength(1)
    expect(groups[0]?.chapter.title).toBe("Gebouw en ruimte")
    expect(groups[0]?.clusters.map((cluster) => cluster.title)).toEqual([
      "Zorgcampus",
      "Zonder cluster",
    ])
    expect(
      groups[0]?.clusters.find((cluster) => cluster.id === "without-cluster")
        ?.projects,
    ).toHaveLength(2)
  })

  it("onderscheidt open, gesloten en alle projecten", () => {
    const open = filterPortfolioRows(rows, defaultPortfolioFilters)
    const closed = filterPortfolioRows(rows, {
      ...defaultPortfolioFilters,
      scope: "closed",
    })
    const all = filterPortfolioRows(rows, {
      ...defaultPortfolioFilters,
      scope: "all",
    })

    expect(open.map((row) => row.project.code)).toEqual(["PRJ-001", "PRJ-003"])
    expect(closed.map((row) => row.project.code)).toEqual(["PRJ-002"])
    expect(all).toHaveLength(3)
  })

  it("zoekt over projectmetadata", () => {
    const result = filterPortfolioRows(rows, {
      ...defaultPortfolioFilters,
      search: "energie",
    })

    expect(result.map((row) => row.project.id)).toEqual([testIds.projectThree])
  })

  it("filtert op projectcoördinator", () => {
    const result = filterPortfolioRows(rows, {
      ...defaultPortfolioFilters,
      coordinatorActorId: testIds.actorTwo,
    })

    expect(result.map((row) => row.project.code)).toEqual(["PRJ-003"])
  })

  it("biedt zonder cluster als expliciete snelle selectie", () => {
    const result = filterPortfolioRows(rows, {
      ...defaultPortfolioFilters,
      clusterId: "without-cluster",
    })

    expect(result.every((row) => !row.project.clusterId)).toBe(true)
    expect(result.map((row) => row.project.code)).toContain("PRJ-003")
  })

  it("berekent topic- en actieaantallen zonder scans per project", () => {
    const project = rows.find((row) => row.project.id === testIds.projectOne)

    expect(project).toMatchObject({
      openTopicCount: 1,
      criticalTopicCount: 1,
      openActionCount: 2,
      overdueActionCount: 1,
    })
  })
})

describe("dashboardaggregatie", () => {
  it("berekent de zes fase-2-KPI's en aandachtselectie", () => {
    const model = buildDashboardModel(createPortfolioTestSession().state, today)

    expect(model.kpis).toEqual({
      activeProjects: 2,
      openTopics: 2,
      criticalTopics: 1,
      openActions: 3,
      overdueActions: 1,
      upcomingActions: 1,
      upcomingMilestones: 1,
    })
    expect(model.recentDecisions).toHaveLength(1)
    expect(model.attentionProjects[0]?.project.id).toBe(testIds.projectOne)
  })

  it("bouwt mijn werk uit open acties van de ingestelde actor", () => {
    const session = createPortfolioTestSession()
    const model = buildDashboardModel(session.state, today, testIds.actorOne)

    expect(model.myActions.length).toBeGreaterThan(0)
    expect(
      model.myActions.every(
        (item) => item.action.ownerActorId === testIds.actorOne,
      ),
    ).toBe(true)
    expect(
      model.myActions.every((item) => item.action.status !== "Afgerond"),
    ).toBe(true)
  })
})
