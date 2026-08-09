import { describe, expect, it } from "vitest"
import { createEmptyDomainCollections } from "../application/services"
import {
  EXCEL_SCHEMA_VERSION,
  excelSchema,
} from "../infrastructure/excel/schema"

const auditHeaders = [
  "datum-aangemaakt",
  "aangemaakt-door-guid",
  "datum-gewijzigd",
  "gewijzigd-door-guid",
  "actief",
]

describe("canonical Excel schema 1.0.0", () => {
  it("dekt alle 22 domeincollecties met unieke tables en werkbladen", () => {
    const collections = Object.keys(createEmptyDomainCollections()).sort()
    const mappedCollections = excelSchema.tables
      .map((table) => table.collection)
      .sort()

    expect(EXCEL_SCHEMA_VERSION).toBe("1.0.0")
    expect(excelSchema.tables).toHaveLength(22)
    expect(mappedCollections).toEqual(collections)
    expect(
      new Set(excelSchema.tables.map((table) => table.tableName)).size,
    ).toBe(22)
    expect(
      new Set(excelSchema.tables.map((table) => table.worksheetName)).size,
    ).toBe(22)
  })

  it("vereist per tabel een primaire GUID en het volledige auditcontract", () => {
    for (const table of excelSchema.tables) {
      expect(table.required).toBe(true)
      expect(table.columns[0]).toMatchObject({
        header: "guid",
        path: "id",
        kind: "uuid",
      })
      expect(table.columns.slice(-5).map((column) => column.header)).toEqual(
        auditHeaders,
      )
    }
  })
})
