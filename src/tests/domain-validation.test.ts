import { describe, expect, it } from "vitest"
import {
  validateActionCompletion,
  validateBudgetAmount,
  validatePlanningEntry,
  validateProject,
  validateTopicParent,
  type LocalDate,
  type UUID,
} from "../domain"
import { localDateSchema, projectBoundarySchema } from "../validation"

const chapterId = "57f0253f-9727-43a8-a4f6-a53782043281" as UUID
const otherChapterId = "26a60f20-614d-4e2c-949b-602acc836ea4" as UUID
const clusterId = "ee285791-0b08-4c86-877c-9e383bd05c7a" as UUID
const projectId = "8da3e588-d51d-4589-88ac-adf9ae47a644" as UUID
const date = (value: string) => value as LocalDate

describe("projectvalidatie", () => {
  it("vereist een hoofdstuk", () => {
    expect(validateProject({})).toContainEqual(
      expect.objectContaining({ code: "project.chapter.required" }),
    )
  })

  it("weigert een cluster uit een ander hoofdstuk", () => {
    const issues = validateProject(
      { chapterId, clusterId },
      { id: clusterId, chapterId: otherChapterId },
    )

    expect(issues).toContainEqual(
      expect.objectContaining({ code: "project.cluster.chapter-mismatch" }),
    )
  })

  it("laat referentiële clustercontrole na de structurele Zod-grens toe", () => {
    expect(
      projectBoundarySchema.safeParse({ chapterId, clusterId }).success,
    ).toBe(true)
  })
})

describe("topicouderschap", () => {
  it("vereist exact één ouder die bij parentType past", () => {
    expect(
      validateTopicParent({
        parentType: "Project",
        projectId,
        clusterId,
      }),
    ).toContainEqual(
      expect.objectContaining({ code: "topic.parent.exactly-one" }),
    )

    expect(
      validateTopicParent({ parentType: "Project", projectId }),
    ).toHaveLength(0)
  })
})

describe("actie-afronding", () => {
  it("vereist een afronddatum voor een afgeronde actie", () => {
    expect(validateActionCompletion({ status: "Afgerond" })).toContainEqual(
      expect.objectContaining({ code: "action.completion-date.required" }),
    )

    expect(
      validateActionCompletion({
        status: "Afgerond",
        completedAt: date("2026-08-09"),
      }),
    ).toHaveLength(0)

    expect(
      validateActionCompletion({
        status: "Open",
        completedAt: date("2026-08-09"),
      }),
    ).toContainEqual(
      expect.objectContaining({ code: "action.completion-date.unexpected" }),
    )
  })
})

describe("planningperiode", () => {
  it("weigert een einddatum vóór de startdatum", () => {
    const issues = validatePlanningEntry({
      kind: "Custom",
      startDate: date("2026-09-10"),
      plannedEndDate: date("2026-09-09"),
      isMilestone: false,
      progressPercent: 50,
    })

    expect(issues).toContainEqual(
      expect.objectContaining({ code: "planning.period.invalid" }),
    )
  })

  it("laat een mijlpaal alleen zonder duur en met 0 of 100 procent toe", () => {
    const issues = validatePlanningEntry({
      kind: "Milestone",
      startDate: date("2026-09-09"),
      plannedEndDate: date("2026-09-09"),
      isMilestone: true,
      progressPercent: 40,
    })

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "planning.milestone.no-start",
        "planning.milestone.progress",
      ]),
    )
  })

  it("valideert reële lokale kalenderdatums aan de externe grens", () => {
    expect(localDateSchema.safeParse("2026-02-29").success).toBe(false)
    expect(localDateSchema.safeParse("2028-02-29").success).toBe(true)
  })
})

describe("budget cents", () => {
  it("aanvaardt alleen niet-negatieve gehele aantallen cents", () => {
    expect(validateBudgetAmount(12_345)).toHaveLength(0)
    expect(validateBudgetAmount(12.34)).toContainEqual(
      expect.objectContaining({ code: "budget.amount.invalid-cents" }),
    )
    expect(validateBudgetAmount(-1)).not.toHaveLength(0)
  })
})
