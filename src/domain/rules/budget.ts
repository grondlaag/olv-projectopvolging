import type { BudgetMutation, BudgetRecord } from "../entities"
import {
  budgetStatuses,
  budgetTypes,
  type BudgetStatus,
  type BudgetType,
} from "../value-objects"

export const BUDGET_AGGREGATION_RULE_REQUIRED =
  "Businessregel vereist: statusselectie en samenhang tussen financiële feiten zijn nog niet beslist."

export interface BudgetTypeTotal {
  type: BudgetType
  recordCount: number
  amountCents: number
}

export interface BudgetStatusTotal {
  status: BudgetStatus
  recordCount: number
  amountCents: number
}

export interface BudgetLedgerSummary {
  recordCount: number
  nonCancelledRecordCount: number
  typeTotals: ReadonlyMap<BudgetType, BudgetTypeTotal>
  statusTotals: ReadonlyMap<BudgetStatus, BudgetStatusTotal>
  moreWorkCents: number
  lessWorkCents: number
  changeOrderImpactCents: number
  hasNonCancelledEstimateRecord: boolean
}

export interface UnavailableBudgetMetric {
  availability: "business-rule-required"
  reason: string
}

export interface BudgetBusinessMetrics {
  approvedBudget: UnavailableBudgetMetric
  currentEstimate: UnavailableBudgetMetric
  committed: UnavailableBudgetMetric
  invoiced: UnavailableBudgetMetric
  paid: UnavailableBudgetMetric
  contingency: UnavailableBudgetMetric
  forecastFinalCost: UnavailableBudgetMetric
  remainingBudget: UnavailableBudgetMetric
  varianceEuro: UnavailableBudgetMetric
  variancePercent: UnavailableBudgetMetric
}

export function budgetBusinessMetrics(): BudgetBusinessMetrics {
  const unavailable = (): UnavailableBudgetMetric => ({
    availability: "business-rule-required",
    reason: BUDGET_AGGREGATION_RULE_REQUIRED,
  })
  return {
    approvedBudget: unavailable(),
    currentEstimate: unavailable(),
    committed: unavailable(),
    invoiced: unavailable(),
    paid: unavailable(),
    contingency: unavailable(),
    forecastFinalCost: unavailable(),
    remainingBudget: unavailable(),
    varianceEuro: unavailable(),
    variancePercent: unavailable(),
  }
}

export function buildBudgetLedgerSummary(
  records: readonly BudgetRecord[],
): BudgetLedgerSummary {
  const activeRecords = records.filter((record) => record.audit.active)
  const typeTotals = new Map<BudgetType, BudgetTypeTotal>(
    budgetTypes.map((type) => [type, { type, recordCount: 0, amountCents: 0 }]),
  )
  const statusTotals = new Map<BudgetStatus, BudgetStatusTotal>(
    budgetStatuses.map((status) => [
      status,
      { status, recordCount: 0, amountCents: 0 },
    ]),
  )
  let moreWorkCents = 0
  let lessWorkCents = 0

  for (const record of activeRecords) {
    const typeTotal = typeTotals.get(record.type)!
    typeTotals.set(record.type, {
      ...typeTotal,
      recordCount: typeTotal.recordCount + 1,
      amountCents: typeTotal.amountCents + record.amountCents,
    })
    const statusTotal = statusTotals.get(record.status)!
    statusTotals.set(record.status, {
      ...statusTotal,
      recordCount: statusTotal.recordCount + 1,
      amountCents: statusTotal.amountCents + record.amountCents,
    })
    if (record.status === "Geannuleerd") continue
    if (record.type === "Meerwerk") moreWorkCents += record.amountCents
    if (record.type === "Minwerk") lessWorkCents += record.amountCents
  }

  return {
    recordCount: activeRecords.length,
    nonCancelledRecordCount: activeRecords.filter(
      (record) => record.status !== "Geannuleerd",
    ).length,
    typeTotals,
    statusTotals,
    moreWorkCents,
    lessWorkCents,
    changeOrderImpactCents: moreWorkCents - lessWorkCents,
    hasNonCancelledEstimateRecord: activeRecords.some(
      (record) => record.type === "Raming" && record.status !== "Geannuleerd",
    ),
  }
}

export function signedMoreOrLessWorkCents(record: BudgetRecord): number {
  if (record.type === "Minwerk") return -record.amountCents
  return record.amountCents
}

export function percentageBasisPoints(
  numeratorCents: number,
  denominatorCents: number,
): number | undefined {
  if (denominatorCents === 0) return undefined
  return Math.round((numeratorCents / denominatorCents) * 10_000)
}

export function parseEuroAmountToCents(value: string): number | undefined {
  const normalized = value
    .trim()
    .replaceAll("\u00a0", "")
    .replaceAll(" ", "")
    .replace(/^€/, "")
  if (!normalized || normalized.startsWith("-")) return undefined

  let euros: string
  let cents = ""
  if (normalized.includes(",")) {
    const parts = normalized.split(",")
    if (parts.length !== 2) return undefined
    euros = parts[0] ?? ""
    cents = parts[1] ?? ""
    if (!/^\d{1,2}$/.test(cents)) return undefined
    if (!/^\d+$/.test(euros) && !/^\d{1,3}(\.\d{3})+$/.test(euros)) {
      return undefined
    }
    euros = euros.replaceAll(".", "")
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    euros = normalized.replaceAll(".", "")
  } else if (/^\d+\.\d{1,2}$/.test(normalized)) {
    const parts = normalized.split(".")
    euros = parts[0] ?? ""
    cents = parts[1] ?? ""
  } else {
    euros = normalized
    if (!/^\d+$/.test(euros)) return undefined
  }

  const paddedCents = cents.padEnd(2, "0")
  const result = Number(euros) * 100 + Number(paddedCents || "0")
  return Number.isSafeInteger(result) ? result : undefined
}

export function formatEuroCents(amountCents: number): string {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100)
}

export function formatPercentageBasisPoints(
  basisPoints: number | undefined,
): string {
  if (basisPoints === undefined) return "—"
  return `${new Intl.NumberFormat("nl-BE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(basisPoints / 100)}%`
}

export function validateBudgetMutationAmounts(
  mutation: Pick<
    BudgetMutation,
    "deltaCents" | "previousAmountCents" | "newAmountCents"
  >,
): readonly { field: string; code: string; message: string }[] {
  const issues: { field: string; code: string; message: string }[] = []
  for (const field of ["previousAmountCents", "newAmountCents"] as const) {
    const value = mutation[field]
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      issues.push({
        field,
        code: "budget.mutation.amount.invalid-cents",
        message:
          "Een oude of nieuwe mutatiewaarde moet gehele, niet-negatieve cents bevatten.",
      })
    }
  }
  if (
    mutation.deltaCents !== undefined &&
    !Number.isSafeInteger(mutation.deltaCents)
  ) {
    issues.push({
      field: "deltaCents",
      code: "budget.mutation.delta.invalid-cents",
      message: "Een budgetmutatiedelta moet een geheel aantal cents zijn.",
    })
  }
  if (
    mutation.previousAmountCents !== undefined &&
    mutation.newAmountCents !== undefined &&
    mutation.deltaCents !== undefined &&
    mutation.newAmountCents - mutation.previousAmountCents !==
      mutation.deltaCents
  ) {
    issues.push({
      field: "deltaCents",
      code: "budget.mutation.delta.inconsistent",
      message:
        "De budgetmutatiedelta komt niet overeen met de oude en nieuwe waarde.",
    })
  }
  return issues
}
