import { describe, expect, it } from "vitest"
import {
  compareDomainStates,
  normalizeDomainState,
} from "../application/services"
import type { AuditFields, LocalDate, UUID } from "../domain"
import { JsonDataFileGateway } from "../infrastructure/json"
import { createPortfolioTestSession, testIds } from "./test-data"

const uuid = (value: string) => value as UUID
const date = (value: string) => value as LocalDate

describe("JSON-gegevensadapter", () => {
  it("start een bruikbare gegevensset met standaardhoofdstukken", () => {
    const session = new JsonDataFileGateway().createNewSession()

    expect(session.format).toBe("json")
    expect(session.origin).toBe("new")
    expect(session.state.records.chapters.map((item) => item.title)).toEqual([
      "Gebouw en ruimte",
      "Technieken en infrastructuur",
      "Beleid en opvolging",
    ])
    expect(session.state.records.config).toHaveLength(1)
    expect(session.hasBlockingIssues).toBe(false)
  })

  it("behoudt alle collecties, Unicode, cents, datums, booleans en relaties", async () => {
    const gateway = new JsonDataFileGateway()
    const source = createPortfolioTestSession()
    const records = structuredClone(source.state.records)
    const audit = records.projects[0]!.audit as AuditFields
    records.budgets.push({
      id: uuid("a0000000-0000-4000-8000-000000000001"),
      projectId: testIds.projectOne,
      topicId: testIds.topicCritical,
      category: "Technieken & inrichting",
      type: "Meerwerk",
      description:
        "Unicode: café, coördinatie, € en lange tekst\nmet regeleinde",
      amountCents: 123456,
      date: date("2026-08-16"),
      status: "Goedgekeurd",
      reference: "REF-JSON-001",
      supplierActorId: testIds.actorTwo,
      audit,
    })
    records.choiceLists.push({
      id: uuid("a0000000-0000-4000-8000-000000000002"),
      listKey: "site",
      valueKey: "campus-noord",
      label: "Campus Noord",
      order: 1,
      system: false,
      active: true,
      audit,
    })
    const state = normalizeDomainState(records)

    const exported = gateway.export(state)
    const reimported = await gateway.importText(
      exported.text,
      exported.fileName,
    )

    expect(reimported.hasBlockingIssues).toBe(false)
    expect(Object.keys(reimported.state.records)).toHaveLength(26)
    expect(compareDomainStates(state, reimported.state)).toEqual({
      equal: true,
      differences: [],
    })
    expect(reimported.state.records.budgets[0]?.amountCents).toBe(123456)
    expect(reimported.state.records.choiceLists[0]?.active).toBe(true)
  })

  it("migreert schema 1.0 zonder bestaande planningitems te verplaatsen", async () => {
    const gateway = new JsonDataFileGateway()
    const source = createPortfolioTestSession().state
    const legacy = JSON.parse(gateway.export(source).text) as {
      schemaVersion: string
      records: Record<string, unknown> & {
        config: { schemaVersion: string }[]
      }
    }
    legacy.schemaVersion = "1.0.0"
    legacy.records.config[0]!.schemaVersion = "1.0.0"
    delete legacy.records.projectPhases
    delete legacy.records.milestones
    delete legacy.records.resources
    delete legacy.records.resourceAssignments

    const migrated = await gateway.importText(
      JSON.stringify(legacy),
      "legacy-1.0.json",
    )

    expect(migrated.hasBlockingIssues).toBe(false)
    expect(migrated.schemaVersion).toBe("1.1.0")
    expect(migrated.state.records.planning).toEqual(source.records.planning)
    expect(migrated.state.records.projectPhases).toEqual([])
    expect(migrated.state.records.milestones).toEqual([])
  })

  it("rapporteert corrupte JSON en verbroken relaties als blokkerend", async () => {
    const gateway = new JsonDataFileGateway()
    const syntax = await gateway.importText("{ niet geldig", "kapot.json")
    expect(syntax.hasBlockingIssues).toBe(true)
    expect(syntax.issues[0]?.code).toBe("json.syntax.invalid")

    const exported = gateway.export(createPortfolioTestSession().state)
    const envelope = JSON.parse(exported.text) as {
      records: { projects: { chapterId: string }[] }
    }
    envelope.records.projects[0]!.chapterId =
      "ffffffff-ffff-4fff-8fff-ffffffffffff"
    const relation = await gateway.importText(
      JSON.stringify(envelope),
      "verbroken.json",
    )
    expect(relation.hasBlockingIssues).toBe(true)
    expect(relation.issues.map((issue) => issue.code)).toContain(
      "data.relation.project-chapter",
    )
  })

  it("weigert een ander bestandstype", async () => {
    const file = new File(["{}"], "gegevens.xlsx")
    await expect(new JsonDataFileGateway().importFile(file)).rejects.toThrow(
      "Selecteer een .json-bestand.",
    )
  })

  it("schrijft leesbare, ingesprongen JSON zonder binaire werkboeklaag", () => {
    const source = createPortfolioTestSession().state
    source.records.config[0]!.schemaVersion = "1.0.0"
    const exported = new JsonDataFileGateway().export(source)
    const envelope = JSON.parse(exported.text) as {
      schemaVersion: string
      records: { config: { schemaVersion: string }[] }
    }
    expect(exported.fileName).toMatch(/\.json$/u)
    expect(exported.blob.type).toBe("application/json;charset=utf-8")
    expect(exported.text).toContain('\n  "format": "olv-projectopvolging"')
    expect(exported.text.endsWith("\n")).toBe(true)
    expect(envelope.schemaVersion).toBe("1.1.0")
    expect(envelope.records.config[0]?.schemaVersion).toBe("1.1.0")
  })
})
