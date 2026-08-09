// @vitest-environment node

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import {
  ActionManagementError,
  ActionManagementService,
  ProjectManagementService,
} from "../application/services"
import {
  buildActionListItems,
  buildProjectActionSummary,
  filterActionListItems,
  groupActionListItemsByOwner,
  isActionOverdue,
} from "../application/queries"
import type { ActionInput } from "../application/services"
import type { LocalDate, UUID } from "../domain"
import { BrowserExcelWorkbookGateway } from "../infrastructure/excel"
import { ExcelReferentialValidator } from "../infrastructure/excel/import/referential-validator"
import { createPortfolioTestSession, testIds } from "./test-data"

const service = new ActionManagementService()
const now = new Date("2026-08-09T12:00:00.000Z")
let idCounter = 0

function createUuid(): UUID {
  idCounter += 1
  return `b0000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}` as UUID
}

function actionInput(patch: Partial<ActionInput> = {}): ActionInput {
  return {
    objectType: "Project",
    objectId: testIds.projectOne,
    title: "Nieuwe verantwoordelijkheid",
    ownerActorId: testIds.actorOne,
    status: "Open",
    priority: "Normaal",
    ...patch,
  }
}

beforeEach(() => {
  idCounter = 0
})

describe("actiebeheer en verantwoordelijkheden", () => {
  it.each([
    ["Project", testIds.projectOne],
    ["Topic", testIds.topicCritical],
    ["Cluster", testIds.cluster],
  ] as const)("maakt een actie in %s-context", (objectType, objectId) => {
    const result = service.createAction(
      createPortfolioTestSession().state,
      actionInput({ objectType, objectId }),
      { now, createUuid },
    )

    expect(result.record).toMatchObject({ objectType, objectId })
    expect(
      result.state.indices.actionsByObject.get(`${objectType}:${objectId}`),
    ).toContainEqual(result.record)
  })

  it("vereist een actieve eigenaar en laat de deadline optioneel", () => {
    const state = createPortfolioTestSession().state
    const withoutDeadline = service.createAction(state, actionInput(), {
      now,
      createUuid,
    })
    expect(withoutDeadline.record.deadline).toBeUndefined()

    expect(() =>
      service.createAction(
        state,
        actionInput({
          ownerActorId: "ffffffff-ffff-4fff-8fff-ffffffffffff" as UUID,
        }),
        { now, createUuid },
      ),
    ).toThrowError(ActionManagementError)
  })

  it("blokkeert een bestaand maar niet-ondersteund Excel-contexttype", () => {
    const records = structuredClone(createPortfolioTestSession().state.records)
    records.actions[0] = {
      ...records.actions[0]!,
      objectType: "PlanningEntry",
      objectId: records.planning[0]!.id,
    }

    expect(
      new ExcelReferentialValidator()
        .validate(records)
        .map((issue) => issue.code),
    ).toContain("excel.action.invalid-context")
  })

  it("leidt achterstalligheid af zonder gesloten acties mee te tellen", () => {
    const state = createPortfolioTestSession().state
    const overdue = state.records.actions[0]!
    const completed = state.records.actions[3]!

    expect(isActionOverdue(overdue, "2026-01-20")).toBe(true)
    expect(isActionOverdue(completed, "2026-01-20")).toBe(false)
  })

  it("zet bij afronden de datum, wist ze bij heropenen en bewaart historie", () => {
    const created = service.createAction(
      createPortfolioTestSession().state,
      actionInput(),
      { now, createUuid },
    )
    const completed = service.updateAction(
      created.state,
      created.record.id,
      {
        title: created.record.title,
        ownerActorId: created.record.ownerActorId,
        status: "Afgerond",
        priority: created.record.priority,
      },
      { now, createUuid },
    )
    const reopened = service.updateAction(
      completed.state,
      created.record.id,
      {
        title: created.record.title,
        ownerActorId: created.record.ownerActorId,
        status: "Bezig",
        priority: created.record.priority,
      },
      { now: new Date("2026-08-10T12:00:00Z"), createUuid },
    )

    expect(completed.record.completedAt).toBe("2026-08-09")
    expect(reopened.record.completedAt).toBeUndefined()
    expect(
      reopened.state.indices.actionHistoryByAction.get(created.record.id),
    ).toEqual([
      expect.objectContaining({
        field: "status",
        previousValue: "Open",
        newValue: "Afgerond",
        changedByActorId: testIds.actorOne,
      }),
      expect.objectContaining({
        field: "status",
        previousValue: "Afgerond",
        newValue: "Bezig",
      }),
    ])
  })

  it("registreert eigenaar, deadline en prioriteit append-only", () => {
    const state = createPortfolioTestSession().state
    const action = state.records.actions[0]!
    const changed = service.updateAction(
      state,
      action.id,
      {
        title: action.title,
        ownerActorId: testIds.actorTwo,
        deadline: "2026-09-01" as LocalDate,
        status: action.status,
        priority: "Kritiek",
      },
      { now, createUuid },
    )

    expect(changed.history.map((entry) => entry.field)).toEqual([
      "ownerActorId",
      "deadline",
      "priority",
    ])
    expect(state.records.actionHistory).toHaveLength(0)
    expect(changed.state.records.actionHistory).toHaveLength(3)
  })

  it("groepeert per eigenaar en filtert de globale actielijst", () => {
    const state = createPortfolioTestSession().state
    const items = buildActionListItems(state)
    const grouped = groupActionListItemsByOwner(items)
    const filtered = filterActionListItems(
      items,
      {
        search: "",
        ownerActorId: testIds.actorOne,
        projectId: testIds.projectOne,
        clusterId: "",
        status: "",
        priority: "",
        dateScope: "overdue",
      },
      "2026-01-20",
    )

    expect(grouped).toHaveLength(2)
    expect(filtered.map((item) => item.action.title)).toEqual([
      "Achterstallige actie",
    ])
  })

  it("aggregeert directe en topicacties per project zonder dubbeltelling", () => {
    const state = createPortfolioTestSession().state
    const summary = buildProjectActionSummary(
      state,
      testIds.projectOne,
      "2026-01-20",
    )

    expect(summary.all.map((item) => item.action.id)).toHaveLength(3)
    expect(new Set(summary.all.map((item) => item.action.id)).size).toBe(3)
    expect(summary.open).toHaveLength(2)
    expect(summary.overdue).toHaveLength(1)
  })
})

describe("fase-5 Excelroundtrip", () => {
  it("behoudt actie en volledige wijzigingshistoriek na export en herimport", async () => {
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
    const actorResult = new ProjectManagementService().createActor(
      imported.state,
      {
        displayName: "Nieuwe actie-eigenaar",
        type: "Intern",
        email: "actie-eigenaar@example.test",
        active: true,
      },
      { now, createUuid },
    )
    const project = imported.state.records.projects[0]!
    const originalOwner = imported.state.records.actors[0]!
    const created = service.createAction(
      actorResult.state,
      actionInput({
        objectId: project.id,
        ownerActorId: originalOwner.id,
        title: "Roundtrip fase 5",
      }),
      { now, createUuid },
    )
    const ownerChanged = service.updateAction(
      created.state,
      created.record.id,
      {
        title: created.record.title,
        ownerActorId: actorResult.record.id,
        status: "Open",
        priority: "Normaal",
      },
      { now, createUuid },
    )
    const deadlineChanged = service.updateAction(
      ownerChanged.state,
      created.record.id,
      {
        title: created.record.title,
        ownerActorId: actorResult.record.id,
        deadline: "2026-09-15" as LocalDate,
        status: "Open",
        priority: "Normaal",
      },
      { now: new Date("2026-08-10T12:00:00Z"), createUuid },
    )
    const completed = service.updateAction(
      deadlineChanged.state,
      created.record.id,
      {
        title: created.record.title,
        ownerActorId: actorResult.record.id,
        deadline: "2026-09-15" as LocalDate,
        status: "Afgerond",
        priority: "Normaal",
      },
      { now: new Date("2026-08-11T12:00:00Z"), createUuid },
    )

    const exported = await gateway.export(completed.state, sourceBuffer)
    const reimported = await gateway.importBuffer(
      exported.buffer,
      exported.fileName,
    )

    expect(reimported.hasBlockingIssues).toBe(false)
    expect(
      reimported.state.indices.actionById.get(created.record.id),
    ).toMatchObject({
      ownerActorId: actorResult.record.id,
      deadline: "2026-09-15",
      status: "Afgerond",
      completedAt: "2026-08-11",
    })
    expect(
      reimported.state.indices.actionHistoryByAction
        .get(created.record.id)
        ?.map((entry) => entry.field),
    ).toEqual(["ownerActorId", "deadline", "status"])
  }, 30_000)
})
