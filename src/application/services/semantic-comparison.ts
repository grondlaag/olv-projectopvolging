import type { Entity } from "../../domain"
import type {
  DomainCollectionKey,
  DomainCollections,
  NormalizedDomainState,
} from "./domain-state"

export interface SemanticDifference {
  collection: DomainCollectionKey
  message: string
}

export interface SemanticComparison {
  equal: boolean
  differences: readonly SemanticDifference[]
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys)
  if (value === null || typeof value !== "object") return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, sortObjectKeys(nestedValue)]),
  )
}

function canonicalize(records: readonly Entity[]): string {
  return JSON.stringify(
    [...records]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(sortObjectKeys),
  )
}

export function compareDomainStates(
  left: NormalizedDomainState,
  right: NormalizedDomainState,
): SemanticComparison {
  const differences: SemanticDifference[] = []

  for (const collection of Object.keys(left.records) as DomainCollectionKey[]) {
    const leftRecords = left.records[collection] as readonly Entity[]
    const rightRecords = right.records[collection] as readonly Entity[]

    if (leftRecords.length !== rightRecords.length) {
      differences.push({
        collection,
        message: `Aantal verschilt: ${leftRecords.length} tegenover ${rightRecords.length}.`,
      })
      continue
    }

    if (canonicalize(leftRecords) !== canonicalize(rightRecords)) {
      differences.push({
        collection,
        message: "IDs, relaties of recordwaarden verschillen.",
      })
    }
  }

  return { equal: differences.length === 0, differences }
}

export function cloneDomainCollections(
  records: DomainCollections,
): DomainCollections {
  return structuredClone(records)
}
