// @vitest-environment node

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  buildBudgetPortfolioModel,
  buildProjectBudgetModel,
} from "../application/queries"
import {
  BudgetManagementError,
  BudgetManagementService,
  compareDomainStates,
  normalizeDomainState,
} from "../application/services"
import {
  BUDGET_AGGREGATION_RULE_REQUIRED,
  budgetBusinessMetrics,
  buildBudgetLedgerSummary,
  formatEuroCents,
  formatPercentageBasisPoints,
  parseEuroAmountToCents,
  percentageBasisPoints,
  signedMoreOrLessWorkCents,
  type BudgetRecord,
  type LocalDate,
  type UUID,
} from "../domain"
import { BrowserExcelWorkbookGateway } from "../infrastructure/excel"
import { createPortfolioTestSession, testIds } from "./test-data"

const uuid = (value: string) => value as UUID
const date = (value: string) => value as LocalDate
const service = new BudgetManagementService()

function record(
  id: string,
  type: BudgetRecord["type"],
  amountCents: number,
  status: BudgetRecord["status"] = "Goedgekeurd",
): BudgetRecord {
  return {
    id: uuid(id),
    projectId: testIds.projectOne,
    category: "Werken",
    type,
    description: `${type} test`,
    amountCents,
    date: date("2026-02-01"),
    status,
    audit: {
      createdAt: "2026-02-01T09:00:00.000Z" as never,
      updatedAt: "2026-02-01T09:00:00.000Z" as never,
      active: true,
    },
  }
}

describe("centsconversie en Belgische presentatie", () => {
  it("converteert Belgische bedragen zonder floating point als source of truth", () => {
    expect(parseEuroAmountToCents("€ 1.234,56")).toBe(123_456)
    expect(parseEuroAmountToCents("1234,5")).toBe(123_450)
    expect(parseEuroAmountToCents("1234.56")).toBe(123_456)
    expect(parseEuroAmountToCents("1.234")).toBe(123_400)
    expect(parseEuroAmountToCents("12,345")).toBeUndefined()
    expect(parseEuroAmountToCents("-1,00")).toBeUndefined()
  })

  it("formatteert euro en percentages in nl-BE en bewaakt nulbudget", () => {
    const formatted = formatEuroCents(123_456)
    expect(formatted).toContain("1.234,56")
    expect(formatted).toContain("€")
    expect(percentageBasisPoints(12_500, 100_000)).toBe(1_250)
    expect(formatPercentageBasisPoints(1_250)).toBe("12,5%")
    expect(percentageBasisPoints(5_000, 0)).toBeUndefined()
    expect(formatPercentageBasisPoints(undefined)).toBe("—")
  })
})

describe("pure budgetledgerregels", () => {
  const records = [
    record(
      "a0000000-0000-4000-8000-000000000001",
      "Goedgekeurd budget",
      1_000_000,
    ),
    record("a0000000-0000-4000-8000-000000000002", "Raming", 1_120_000),
    record(
      "a0000000-0000-4000-8000-000000000003",
      "Contract",
      800_000,
      "Vastgelegd",
    ),
    record(
      "a0000000-0000-4000-8000-000000000004",
      "Factuur",
      400_000,
      "Gefactureerd",
    ),
    record(
      "a0000000-0000-4000-8000-000000000005",
      "Betaling",
      300_000,
      "Betaald",
    ),
    record(
      "a0000000-0000-4000-8000-000000000006",
      "Meerwerk",
      100_000,
      "Vastgelegd",
    ),
    record(
      "a0000000-0000-4000-8000-000000000007",
      "Minwerk",
      40_000,
      "Vastgelegd",
    ),
    record(
      "a0000000-0000-4000-8000-000000000008",
      "Contingentie",
      50_000,
      "Verwacht",
    ),
    record(
      "a0000000-0000-4000-8000-000000000009",
      "Correctie",
      10_000,
      "Goedgekeurd",
    ),
  ]

  it("splitst factuur, betaling, contingentie en andere types exact uit", () => {
    const summary = buildBudgetLedgerSummary(records)
    expect(summary.typeTotals.get("Goedgekeurd budget")?.amountCents).toBe(
      1_000_000,
    )
    expect(summary.typeTotals.get("Raming")?.amountCents).toBe(1_120_000)
    expect(summary.typeTotals.get("Contract")?.amountCents).toBe(800_000)
    expect(summary.typeTotals.get("Factuur")?.amountCents).toBe(400_000)
    expect(summary.typeTotals.get("Betaling")?.amountCents).toBe(300_000)
    expect(summary.typeTotals.get("Contingentie")?.amountCents).toBe(50_000)
    expect(summary.typeTotals.get("Correctie")?.amountCents).toBe(10_000)
  })

  it("past de positieve opslagconventie toe op meer- en minwerk", () => {
    const summary = buildBudgetLedgerSummary(records)
    expect(summary.moreWorkCents).toBe(100_000)
    expect(summary.lessWorkCents).toBe(40_000)
    expect(summary.changeOrderImpactCents).toBe(60_000)
    expect(signedMoreOrLessWorkCents(records[5]!)).toBe(100_000)
    expect(signedMoreOrLessWorkCents(records[6]!)).toBe(-40_000)
  })

  it("sluit geannuleerd meerwerk uit de expliciete meer/min-impact", () => {
    const cancelled = record(
      "a0000000-0000-4000-8000-000000000010",
      "Meerwerk",
      500_000,
      "Geannuleerd",
    )
    const summary = buildBudgetLedgerSummary([...records, cancelled])
    expect(summary.moreWorkCents).toBe(100_000)
    expect(summary.statusTotals.get("Geannuleerd")?.amountCents).toBe(500_000)
  })

  it("weigert onbesliste KPI's impliciet te berekenen", () => {
    const metrics = budgetBusinessMetrics()
    expect(metrics.currentEstimate).toEqual({
      availability: "business-rule-required",
      reason: BUDGET_AGGREGATION_RULE_REQUIRED,
    })
    expect(metrics.forecastFinalCost.availability).toBe(
      "business-rule-required",
    )
    expect(metrics.variancePercent.availability).toBe("business-rule-required")
  })
})

describe("budgetbeheer, projectcontext en correctiehistorie", () => {
  it("maakt een projectbudgetrecord en telt een topicrecord nergens dubbel", () => {
    const session = createPortfolioTestSession()
    const created = service.createRecord(
      session.state,
      {
        projectId: testIds.projectOne,
        topicId: testIds.topicCritical,
        category: "Fasering",
        type: "Meerwerk",
        description: "Nachtwerk zorgcontinuïteit",
        amountCents: 125_000,
        date: date("2026-03-01"),
        status: "Verwacht",
      },
      {
        createUuid: () => uuid("b0000000-0000-4000-8000-000000000001"),
      },
    )
    const project = buildProjectBudgetModel(created.state, testIds.projectOne)!
    const topic = buildProjectBudgetModel(
      created.state,
      testIds.projectOne,
      testIds.topicCritical,
    )!
    const portfolio = buildBudgetPortfolioModel(created.state)

    expect(project.summary.recordCount).toBe(1)
    expect(topic.summary.recordCount).toBe(1)
    expect(portfolio.portfolioSummary.recordCount).toBe(1)
    expect(
      created.state.indices.budgetByProject.get(testIds.projectOne),
    ).toHaveLength(1)
    expect(
      created.state.indices.budgetByTopic.get(testIds.topicCritical),
    ).toHaveLength(1)
  })

  it("weigert een topic uit een ander project en een inactieve leverancier", () => {
    const session = createPortfolioTestSession()
    expect(() =>
      service.createRecord(session.state, {
        projectId: testIds.projectOne,
        topicId: testIds.topicNormal,
        category: "Werken",
        type: "Raming",
        description: "Verkeerde context",
        amountCents: 10_000,
        date: date("2026-03-01"),
        status: "Concept",
      }),
    ).toThrow(BudgetManagementError)

    const inactiveState = structuredClone(session.state.records)
    inactiveState.actors[0]!.active = false
    const normalized = normalizeDomainState(inactiveState)
    expect(() =>
      service.createRecord(normalized, {
        projectId: testIds.projectOne,
        category: "Werken",
        type: "Contract",
        description: "Leverancierscontrole",
        amountCents: 10_000,
        date: date("2026-03-01"),
        status: "Vastgelegd",
        supplierActorId: testIds.actorOne,
      }),
    ).toThrow("De leverancier moet een actieve actor zijn.")
  })

  it("corrigeert een fout met oude/nieuwe waarde, delta, auteur, reden en datum", () => {
    const session = createPortfolioTestSession()
    const created = service.createRecord(
      session.state,
      {
        projectId: testIds.projectOne,
        category: "Werken",
        type: "Factuur",
        description: "Factuur met tikfout",
        amountCents: 120_000,
        date: date("2026-03-01"),
        status: "Gefactureerd",
      },
      {
        createUuid: () => uuid("b0000000-0000-4000-8000-000000000002"),
      },
    )
    const corrected = service.correctAmount(
      created.state,
      created.record.id,
      { newAmountCents: 102_000, reason: "Cijfers waren omgewisseld." },
      {
        now: new Date("2026-03-02T10:00:00.000Z"),
        createUuid: () => uuid("b0000000-0000-4000-8000-000000000003"),
      },
    )

    expect(corrected.record.amountCents).toBe(102_000)
    expect(corrected.mutation).toMatchObject({
      changeType: "Foutcorrectie",
      previousAmountCents: 120_000,
      newAmountCents: 102_000,
      deltaCents: -18_000,
      reason: "Cijfers waren omgewisseld.",
      date: "2026-03-02",
      authorActorId: testIds.actorOne,
    })
    expect(
      corrected.state.indices.budgetMutationsByBudgetRecord.get(
        created.record.id,
      ),
    ).toHaveLength(1)
  })
})

describe("fase-7 Excelroundtrip", () => {
  it("behoudt budgetfeiten, topickoppeling, cents en BudgetMutation", async () => {
    const fixturePath = resolve(
      process.cwd(),
      "src/tests/fixtures/excel/small-valid.xlsx",
    )
    const bytes = await readFile(fixturePath)
    const source = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer
    const gateway = new BrowserExcelWorkbookGateway()
    const imported = await gateway.importBuffer(source, "small-valid.xlsx")
    let state = imported.state
    const ids = [
      "c0000000-0000-4000-8000-000000000001",
      "c0000000-0000-4000-8000-000000000002",
      "c0000000-0000-4000-8000-000000000003",
      "c0000000-0000-4000-8000-000000000004",
    ].map(uuid)
    const project = state.records.projects[0]!
    const topic = state.records.topics[0]!
    const actor = state.records.actors[0]!
    const facts = [
      ["Goedgekeurd budget", 25_000_000, "Goedgekeurd"] as const,
      ["Raming", 26_500_000, "Verwacht"] as const,
      ["Contract", 18_000_000, "Vastgelegd"] as const,
      ["Meerwerk", 750_000, "Vastgelegd"] as const,
    ]
    for (const [index, fact] of facts.entries()) {
      const result = service.createRecord(
        state,
        {
          projectId: project.id,
          ...(index === 3 ? { topicId: topic.id } : {}),
          category: "Fase 7",
          type: fact[0],
          description: `Roundtrip ${fact[0]}`,
          amountCents: fact[1],
          date: date("2026-04-01"),
          status: fact[2],
          supplierActorId: actor.id,
          reference: `F7-${index + 1}`,
        },
        { createUuid: () => ids[index]! },
      )
      state = result.state
    }
    const corrected = service.correctAmount(
      state,
      ids[2]!,
      { newAmountCents: 17_950_000, reason: "Contractbedrag gecorrigeerd." },
      {
        now: new Date("2026-04-02T09:00:00.000Z"),
        createUuid: () => uuid("c0000000-0000-4000-8000-000000000005"),
      },
    )
    const exported = await gateway.export(
      corrected.state,
      imported.sourceBuffer,
    )
    const reimported = await gateway.importBuffer(
      exported.buffer,
      exported.fileName,
    )

    expect(reimported.hasBlockingIssues).toBe(false)
    expect(compareDomainStates(corrected.state, reimported.state)).toEqual({
      equal: true,
      differences: [],
    })
    expect(reimported.state.indices.budgetById.get(ids[2]!)?.amountCents).toBe(
      17_950_000,
    )
    expect(reimported.state.indices.budgetByTopic.get(topic.id)).toContainEqual(
      expect.objectContaining({ id: ids[3]!, amountCents: 750_000 }),
    )
    expect(
      reimported.state.indices.budgetMutationsByBudgetRecord.get(ids[2]!),
    ).toHaveLength(1)
  })
})
