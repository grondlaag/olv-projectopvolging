import type { PlanningDependency, PlanningEntry } from "../entities"
import type { PlanningDependencyType, UUID } from "../value-objects"
import type { ValidationIssue, ValidationResult } from "./validation"

export interface PlanningDependencyValidationInput {
  predecessorPlanningId: UUID
  successorPlanningId: UUID
  type: PlanningDependencyType
}

type DependencyEdge = Pick<
  PlanningDependency,
  "predecessorPlanningId" | "successorPlanningId"
>

/** Pure graph validation used by both interactive mutations and Excel import. */
export function hasPlanningDependencyCycle(
  dependencies: readonly DependencyEdge[],
): boolean {
  const graph = new Map<UUID, UUID[]>()
  for (const dependency of dependencies) {
    const successors = graph.get(dependency.predecessorPlanningId) ?? []
    successors.push(dependency.successorPlanningId)
    graph.set(dependency.predecessorPlanningId, successors)
  }

  const status = new Map<UUID, "visiting" | "visited">()
  for (const start of graph.keys()) {
    if (status.has(start)) continue
    status.set(start, "visiting")
    const stack: { id: UUID; successorIndex: number }[] = [
      { id: start, successorIndex: 0 },
    ]
    while (stack.length) {
      const current = stack.at(-1)!
      const successors = graph.get(current.id) ?? []
      if (current.successorIndex >= successors.length) {
        status.set(current.id, "visited")
        stack.pop()
        continue
      }
      const successor = successors[current.successorIndex++]!
      if (status.get(successor) === "visiting") return true
      if (status.get(successor) === "visited") continue
      status.set(successor, "visiting")
      stack.push({ id: successor, successorIndex: 0 })
    }
  }
  return false
}

export function validatePlanningDependency(
  entries: readonly PlanningEntry[],
  existingDependencies: readonly DependencyEdge[],
  dependency: PlanningDependencyValidationInput,
): ValidationResult {
  const issues: ValidationIssue[] = []
  const entryById = new Map(entries.map((entry) => [entry.id, entry]))
  const predecessor = entryById.get(dependency.predecessorPlanningId)
  const successor = entryById.get(dependency.successorPlanningId)

  if (!predecessor) {
    issues.push({
      field: "predecessorPlanningId",
      code: "planning.dependency.predecessor-missing",
      message: "Het voorgaande planningitem bestaat niet.",
    })
  }
  if (!successor) {
    issues.push({
      field: "successorPlanningId",
      code: "planning.dependency.successor-missing",
      message: "Het volgende planningitem bestaat niet.",
    })
  }
  if (dependency.predecessorPlanningId === dependency.successorPlanningId) {
    issues.push({
      field: "successorPlanningId",
      code: "planning.dependency.self",
      message: "Een planningitem kan niet van zichzelf afhangen.",
    })
  }
  if (
    predecessor &&
    successor &&
    predecessor.projectId !== successor.projectId
  ) {
    issues.push({
      field: "successorPlanningId",
      code: "planning.dependency.cross-project",
      message: "Afhankelijkheden moeten binnen hetzelfde project blijven.",
    })
  }
  if (
    existingDependencies.some(
      (item) =>
        item.predecessorPlanningId === dependency.predecessorPlanningId &&
        item.successorPlanningId === dependency.successorPlanningId,
    )
  ) {
    issues.push({
      field: "successorPlanningId",
      code: "planning.dependency.duplicate",
      message: "Deze finish-to-start-afhankelijkheid bestaat al.",
    })
  }
  if (
    issues.length === 0 &&
    hasPlanningDependencyCycle([...existingDependencies, dependency])
  ) {
    issues.push({
      field: "successorPlanningId",
      code: "planning.dependency.cycle",
      message: "Deze afhankelijkheid zou een cyclus in de planning maken.",
    })
  }

  return issues
}
