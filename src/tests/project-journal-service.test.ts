import { describe, expect, it } from "vitest"
import {
  buildProjectJournalWorkspace,
  decisionRequestsForProject,
} from "../application/queries"
import {
  parseJournalCommand,
  ProjectJournalService,
} from "../application/services"
import type { LocalDate, UUID } from "../domain"
import { createPortfolioTestSession, testIds } from "./test-data"

const service = new ProjectJournalService()
const now = new Date("2026-02-10T10:00:00.000Z")
let sequence = 0
const createUuid = () =>
  `a0000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}` as UUID

describe("uniform projectjournaal", () => {
  it("projecteert acties, beslissingen en historiek per topic en sorteert op activiteit", () => {
    const state = createPortfolioTestSession().state
    const workspace = buildProjectJournalWorkspace(
      state,
      testIds.projectOne,
      "2026-01-01" as LocalDate,
    )!

    expect(workspace.activeTopics.map((item) => item.topic.id)).toEqual([
      testIds.topicCritical,
    ])
    expect(workspace.closedTopics.map((item) => item.topic.id)).toEqual([
      testIds.topicClosed,
    ])
    expect(workspace.activeTopics[0]?.openActions[0]?.content).toBe(
      "Topicactie",
    )
  })

  it("maakt alle entrytypes vanuit dezelfde composer en behoudt hun topiccontext", () => {
    sequence = 0
    let state = createPortfolioTestSession().state
    for (const value of [
      "Nieuwe stand van zaken",
      "/actie Controleer de toegang",
      "/besluit Toegang blijft tijdelijk gesloten",
    ]) {
      state = service.executeComposer(state, testIds.topicCritical, value, {
        now,
        createUuid,
      }).state
    }
    const topic = buildProjectJournalWorkspace(
      state,
      testIds.projectOne,
      "2026-02-10" as LocalDate,
    )!.activeTopics[0]!

    expect(
      topic.openActions.some(
        (item) => item.content === "Controleer de toegang",
      ),
    ).toBe(true)
    expect(
      topic.decisions.some(
        (item) => item.content === "Toegang blijft tijdelijk gesloten",
      ),
    ).toBe(true)
    expect(
      topic.history.some((item) => item.content === "Nieuwe stand van zaken"),
    ).toBe(true)
  })

  it("wisselt een update naar een actie en registreert de typehistoriek", () => {
    sequence = 0
    const initial = createPortfolioTestSession().state
    const added = service.addEntry(
      initial,
      testIds.topicCritical,
      "update",
      "Nog te behandelen punt",
      { now, createUuid },
    )
    const id = (added.record as { id: UUID }).id
    const converted = service.convertEntry(added.state, id, "action", {
      now,
      createUuid,
    })

    expect(converted.state.indices.actionById.get(id)?.audit.active).toBe(true)
    expect(converted.state.indices.updateById.get(id)?.audit.active).toBe(false)
    expect(converted.state.records.actionHistory.at(-1)).toMatchObject({
      actionId: id,
      field: "currentType",
      previousValue: "update",
      newValue: "action",
    })
  })

  it("bewaart en resolveert een beslissingsvraag zonder nieuw JSON-recordtype", () => {
    sequence = 0
    const initial = createPortfolioTestSession().state
    const added = service.addDecisionRequest(
      initial,
      testIds.projectOne,
      "Topic",
      testIds.topicCritical,
      "Mag de spoedtoegang open?",
      [testIds.actorTwo],
      "2026-02-15" as LocalDate,
      { now, createUuid },
    )
    expect(
      decisionRequestsForProject(added.state, testIds.projectOne)[0],
    ).toMatchObject({
      question: "Mag de spoedtoegang open?",
      status: "pending",
    })

    const resolved = service.resolveDecisionRequest(
      added.state,
      added.record!.id,
      testIds.topicCritical,
      "De toegang mag open.",
      { now, createUuid },
    )
    expect(
      decisionRequestsForProject(resolved.state, testIds.projectOne)[0]?.status,
    ).toBe("decided")
  })

  it("ondersteunt de afgesproken Nederlandstalige slashcommando's", () => {
    expect(parseJournalCommand("/actie Bel aannemer")).toMatchObject({
      name: "action",
      content: "Bel aannemer",
    })
    expect(parseJournalCommand("/sluit").name).toBe("close")
    expect(parseJournalCommand("Gewone tekst").name).toBe("update")
  })
})
