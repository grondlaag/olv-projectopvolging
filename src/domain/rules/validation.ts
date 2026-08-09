import type {
  ActionStatus,
  LocalDate,
  PlanningKind,
  TopicParentType,
  UUID,
} from "../value-objects"

export interface ValidationIssue {
  field: string
  code: string
  message: string
}

export type ValidationResult = readonly ValidationIssue[]

interface ClusterReference {
  id: UUID
  chapterId: UUID
}

export interface ProjectValidationInput {
  chapterId?: UUID | undefined
  clusterId?: UUID | undefined
  progressPercent?: number | undefined
}

export function validateProject(
  project: ProjectValidationInput,
  cluster?: ClusterReference,
): ValidationResult {
  const issues: ValidationIssue[] = []

  if (!project.chapterId) {
    issues.push({
      field: "chapterId",
      code: "project.chapter.required",
      message: "Een project moet aan een hoofdstuk gekoppeld zijn.",
    })
  }

  if (project.clusterId) {
    if (!cluster || cluster.id !== project.clusterId) {
      issues.push({
        field: "clusterId",
        code: "project.cluster.unknown",
        message: "De gekozen cluster bestaat niet.",
      })
    } else if (project.chapterId && cluster.chapterId !== project.chapterId) {
      issues.push({
        field: "clusterId",
        code: "project.cluster.chapter-mismatch",
        message: "De cluster hoort niet bij het hoofdstuk van dit project.",
      })
    }
  }

  issues.push(...validateProgress(project.progressPercent))
  return issues
}

export interface TopicParentValidationInput {
  parentType: TopicParentType
  projectId?: UUID | undefined
  clusterId?: UUID | undefined
}

export function validateTopicParent(
  topic: TopicParentValidationInput,
): ValidationResult {
  const parentCount =
    Number(Boolean(topic.projectId)) + Number(Boolean(topic.clusterId))
  const matchesParentType =
    (topic.parentType === "Project" && Boolean(topic.projectId)) ||
    (topic.parentType === "Cluster" && Boolean(topic.clusterId))

  if (parentCount !== 1 || !matchesParentType) {
    return [
      {
        field: "parentType",
        code: "topic.parent.exactly-one",
        message: "Een topic hoort bij exact één project of één cluster.",
      },
    ]
  }

  return []
}

export interface ActionCompletionValidationInput {
  status: ActionStatus
  completedAt?: LocalDate | undefined
}

export function validateActionCompletion(
  action: ActionCompletionValidationInput,
): ValidationResult {
  if (action.status === "Afgerond" && !action.completedAt) {
    return [
      {
        field: "completedAt",
        code: "action.completion-date.required",
        message: "Een afgeronde actie vereist een afronddatum.",
      },
    ]
  }

  if (action.status !== "Afgerond" && action.completedAt) {
    return [
      {
        field: "completedAt",
        code: "action.completion-date.unexpected",
        message:
          "Een afronddatum is alleen toegestaan wanneer de actie afgerond is.",
      },
    ]
  }

  return []
}

export interface PlanningValidationInput {
  kind: PlanningKind
  startDate?: LocalDate | undefined
  plannedEndDate?: LocalDate | undefined
  progressPercent?: number | undefined
  isMilestone: boolean
}

export function validatePlanningEntry(
  entry: PlanningValidationInput,
): ValidationResult {
  const issues: ValidationIssue[] = []

  if (!entry.plannedEndDate) {
    issues.push({
      field: "plannedEndDate",
      code: "planning.end.required",
      message: "Een planningitem vereist een geplande einddatum.",
    })
  }

  if (entry.isMilestone || entry.kind === "Milestone") {
    if (entry.kind === "Milestone" && !entry.isMilestone) {
      issues.push({
        field: "isMilestone",
        code: "planning.milestone.kind-mismatch",
        message:
          "Een planningitem van het type mijlpaal moet als mijlpaal gemarkeerd zijn.",
      })
    }
    if (entry.startDate) {
      issues.push({
        field: "startDate",
        code: "planning.milestone.no-start",
        message: "Een mijlpaal heeft geen startdatum of duur.",
      })
    }
    if (
      entry.progressPercent !== undefined &&
      entry.progressPercent !== 0 &&
      entry.progressPercent !== 100
    ) {
      issues.push({
        field: "progressPercent",
        code: "planning.milestone.progress",
        message: "De voortgang van een mijlpaal is 0 of 100 procent.",
      })
    }
  } else {
    if (!entry.startDate) {
      issues.push({
        field: "startDate",
        code: "planning.start.required",
        message: "Een planningperiode vereist een startdatum.",
      })
    }
    if (
      entry.startDate &&
      entry.plannedEndDate &&
      entry.plannedEndDate < entry.startDate
    ) {
      issues.push({
        field: "plannedEndDate",
        code: "planning.period.invalid",
        message: "De einddatum mag niet vóór de startdatum liggen.",
      })
    }
  }

  issues.push(...validateProgress(entry.progressPercent))
  return issues
}

export function validateProgress(progress?: number): ValidationResult {
  if (
    progress !== undefined &&
    (!Number.isFinite(progress) || progress < 0 || progress > 100)
  ) {
    return [
      {
        field: "progressPercent",
        code: "progress.out-of-range",
        message: "Voortgang moet tussen 0 en 100 procent liggen.",
      },
    ]
  }

  return []
}

export function validateBudgetAmount(amountCents: number): ValidationResult {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    return [
      {
        field: "amountCents",
        code: "budget.amount.invalid-cents",
        message:
          "Een budgetbedrag moet een niet-negatief geheel aantal cents zijn.",
      },
    ]
  }

  return []
}
