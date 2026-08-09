import type { CellValue } from "exceljs"
import { z } from "zod"
import { localDateSchema, uuidSchema } from "../../../validation"
import type { ExcelColumnDefinition, ExcelTableDefinition } from "../schema"
import type { ExcelValidationIssue } from "../validation-report"

export interface MappedExcelRow {
  entity?: Record<string, unknown>
  issues: readonly ExcelValidationIssue[]
}

function unwrapCellValue(value: CellValue | undefined): unknown {
  if (value === null || value === undefined) return undefined
  if (value instanceof Date) return value
  if (typeof value !== "object") return value
  if ("result" in value) return unwrapCellValue(value.result as CellValue)
  if ("text" in value && typeof value.text === "string") return value.text
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText
      .map((part) =>
        typeof part === "object" && part && "text" in part
          ? String(part.text)
          : "",
      )
      .join("")
  }
  return value
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === ""
}

function localDateFromDate(value: Date): string {
  const year = String(value.getUTCFullYear()).padStart(4, "0")
  const month = String(value.getUTCMonth() + 1).padStart(2, "0")
  const day = String(value.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function normalizeValue(
  rawValue: CellValue | undefined,
  column: ExcelColumnDefinition,
  repairMode: boolean,
): { value: unknown; repaired: boolean } {
  const raw = unwrapCellValue(rawValue)
  if (isEmpty(raw)) return { value: undefined, repaired: false }

  if (column.kind === "string" || column.kind === "uuid") {
    if (typeof raw !== "string") return { value: raw, repaired: false }
    const trimmed = raw.trim()
    return {
      value: repairMode ? trimmed : raw,
      repaired: repairMode && trimmed !== raw,
    }
  }

  if (column.kind === "localDate") {
    return {
      value: raw instanceof Date ? localDateFromDate(raw) : raw,
      repaired: false,
    }
  }

  if (column.kind === "dateTime") {
    return {
      value: raw instanceof Date ? raw.toISOString() : raw,
      repaired: false,
    }
  }

  if (column.kind === "money" && typeof raw === "number") {
    const cents = Math.round(raw * 100)
    return {
      value: cents,
      repaired: false,
    }
  }

  return { value: raw, repaired: false }
}

function zodSchemaForColumn(column: ExcelColumnDefinition): z.ZodType {
  let schema: z.ZodType

  switch (column.kind) {
    case "uuid":
      schema = uuidSchema
      break
    case "localDate":
      schema = localDateSchema
      break
    case "dateTime":
      schema = z.iso.datetime()
      break
    case "integer":
      schema = z.number().safe().int()
      break
    case "number":
      schema = z.number().finite()
      break
    case "boolean":
      schema = z.boolean()
      break
    case "money":
      schema = z.number().safe().int()
      if (!column.allowNegative) schema = schema.pipe(z.number().nonnegative())
      break
    default:
      schema = z.string().min(1)
  }

  if (column.allowedValues) {
    schema = schema.refine(
      (value) => column.allowedValues?.includes(String(value)) ?? true,
      `Waarde hoort niet bij de toegestane keuzelijst.`,
    )
  }

  return column.optional ? schema.optional() : schema
}

function issueCode(column: ExcelColumnDefinition): string {
  if (column.kind === "uuid") return "excel.guid.invalid"
  if (column.kind === "localDate" || column.kind === "dateTime")
    return "excel.date.invalid"
  if (column.kind === "money") return "excel.budget.invalid"
  return "excel.value.invalid"
}

function setPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  if (value === undefined) return
  const parts = path.split(".")
  let cursor = target
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part]
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      cursor[part] = {}
    }
    cursor = cursor[part] as Record<string, unknown>
  }
  const finalPart = parts.at(-1)
  if (finalPart) cursor[finalPart] = value
}

export class ExcelRowMapper {
  map(
    columnNames: readonly string[],
    definition: ExcelTableDefinition,
    row: readonly CellValue[],
    rowNumber: number,
    repairMode: boolean,
  ): MappedExcelRow {
    const flat: Record<string, unknown> = {}
    const issues: ExcelValidationIssue[] = []

    for (const column of definition.columns) {
      const columnIndex = columnNames.findIndex(
        (candidate) => candidate === column.header,
      )
      if (columnIndex < 0) continue

      const raw = row[columnIndex]
      const normalized = normalizeValue(raw, column, repairMode)

      if (
        column.kind === "money" &&
        typeof unwrapCellValue(raw) === "number" &&
        Math.abs(
          (unwrapCellValue(raw) as number) * 100 - Number(normalized.value),
        ) > 1e-7
      ) {
        issues.push({
          level: "Blocking",
          code: "excel.budget.cent-precision",
          tableName: definition.tableName,
          rowNumber,
          columnName: column.header,
          message: `Bedrag in ${column.header} heeft meer dan twee decimalen.`,
        })
        continue
      }

      if (normalized.repaired) {
        issues.push({
          level: "Recoverable",
          code: "excel.whitespace.trimmed",
          tableName: definition.tableName,
          rowNumber,
          columnName: column.header,
          message: `Overtollige witruimte is verwijderd uit ${column.header}.`,
          repaired: true,
        })
      }

      flat[column.path] = normalized.value
    }

    const shape: Record<string, z.ZodType> = {}
    for (const column of definition.columns) {
      shape[column.path] = zodSchemaForColumn(column)
    }
    const parsed = z.object(shape).safeParse(flat)

    if (!parsed.success) {
      for (const zodIssue of parsed.error.issues) {
        const path = String(zodIssue.path[0] ?? "")
        const column = definition.columns.find((item) => item.path === path)
        issues.push({
          level: "Blocking",
          code: column ? issueCode(column) : "excel.row.invalid",
          tableName: definition.tableName,
          rowNumber,
          ...(column ? { columnName: column.header } : {}),
          message: `${column?.header ?? path}: ${zodIssue.message}`,
        })
      }
      return { issues }
    }

    const entity: Record<string, unknown> = {}
    for (const column of definition.columns) {
      setPath(
        entity,
        column.path,
        parsed.data[column.path] ?? column.defaultValue,
      )
    }

    return { entity, issues }
  }
}
