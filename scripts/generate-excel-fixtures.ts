import { mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import ExcelJS from "exceljs"
import {
  normalizeDomainState,
  type DomainCollections,
} from "../src/application/services"
import type {
  Actor,
  AuditFields,
  BudgetRecord,
  Chapter,
  Cluster,
  Config,
  DateTime,
  LocalDate,
  PlanningDependency,
  PlanningEntry,
  Project,
  Topic,
  UUID,
} from "../src/domain"
import { ExcelExporter } from "../src/infrastructure/excel/export"
import { createEmptyDomainCollections } from "../src/application/services"

const outputDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/tests/fixtures/excel",
)
const exporter = new ExcelExporter()
const date = (value: string) => value as LocalDate
const dateTime = (value: string) => value as DateTime
const uuid = (value: string) => value as UUID

const ids = {
  config: uuid("10000000-0000-4000-8000-000000000001"),
  workbook: uuid("10000000-0000-4000-8000-000000000002"),
  chapter: uuid("20000000-0000-4000-8000-000000000001"),
  cluster: uuid("30000000-0000-4000-8000-000000000001"),
  actor: uuid("40000000-0000-4000-8000-000000000001"),
  projectOne: uuid("50000000-0000-4000-8000-000000000001"),
  projectTwo: uuid("50000000-0000-4000-8000-000000000002"),
  topic: uuid("60000000-0000-4000-8000-000000000001"),
  planningOne: uuid("70000000-0000-4000-8000-000000000001"),
  planningTwo: uuid("70000000-0000-4000-8000-000000000002"),
  dependency: uuid("80000000-0000-4000-8000-000000000001"),
  reverseDependency: uuid("80000000-0000-4000-8000-000000000002"),
  budget: uuid("90000000-0000-4000-8000-000000000001"),
  unknown: uuid("ffffffff-ffff-4fff-8fff-ffffffffffff"),
} as const

const fixedDateTime = dateTime("2026-01-15T09:30:00.000Z")

function audit(): AuditFields {
  return {
    createdAt: fixedDateTime,
    createdByActorId: ids.actor,
    updatedAt: fixedDateTime,
    updatedByActorId: ids.actor,
    active: true,
  }
}

function config(): Config {
  return {
    id: ids.config,
    schemaVersion: "1.0.0",
    workbookId: ids.workbook,
    createdAt: fixedDateTime,
    appVersion: "1.0.0-test",
    defaultCurrency: "EUR",
    currentActorId: ids.actor,
    audit: audit(),
  }
}

function emptyRecords(): DomainCollections {
  const records = createEmptyDomainCollections()
  const record = config()
  delete record.currentActorId
  delete record.audit.createdByActorId
  delete record.audit.updatedByActorId
  records.config.push(record)
  return records
}

function smallRecords(): DomainCollections {
  const records = createEmptyDomainCollections()
  const chapter: Chapter = {
    id: ids.chapter,
    code: "H1",
    title: "Gebouw en ruimte",
    order: 1,
    status: "Active",
    audit: audit(),
  }
  const cluster: Cluster = {
    id: ids.cluster,
    chapterId: ids.chapter,
    code: "CL-01",
    title: "Zorgcampus",
    description: "Synthetische cluster voor roundtriptests.",
    status: "Active",
    order: 1,
    audit: audit(),
  }
  const actor: Actor = {
    id: ids.actor,
    type: "Intern",
    displayName: "Testcoördinator",
    email: "synthetisch@example.invalid",
    organization: "Voorbeeldzorg",
    role: "Projectcoördinator",
    active: true,
    audit: audit(),
  }
  const projectOne: Project = {
    id: ids.projectOne,
    chapterId: ids.chapter,
    clusterId: ids.cluster,
    code: "PRJ-001",
    title: "Synthetisch renovatieproject",
    description: "Uitsluitend synthetische testdata.",
    status: "Uitvoering",
    phase: "Uitvoering",
    site: "Testsite",
    coordinatorActorId: ids.actor,
    startDate: date("2026-01-15"),
    plannedEndDate: date("2026-12-31"),
    progressPercent: 37.5,
    audit: audit(),
  }
  const projectTwo: Project = {
    id: ids.projectTwo,
    chapterId: ids.chapter,
    code: "PRJ-002",
    title: "Synthetisch beleidsproject",
    description: "Tweede record voor duplicate-GUID-tests.",
    status: "Voorbereiding",
    phase: "Voorbereiding",
    startDate: date("2026-02-01"),
    plannedEndDate: date("2027-03-15"),
    progressPercent: 10,
    audit: audit(),
  }
  const topic: Topic = {
    id: ids.topic,
    parentType: "Project",
    projectId: ids.projectOne,
    code: "TOP-001",
    title: "Tijdelijke toegang",
    context: "Synthetische context.",
    ownerActorId: ids.actor,
    priority: "Hoog",
    status: "Open",
    order: 1,
    audit: audit(),
  }
  const planningOne: PlanningEntry = {
    id: ids.planningOne,
    projectId: ids.projectOne,
    topicId: ids.topic,
    kind: "Topic",
    title: "Tijdelijke toegang realiseren",
    startDate: date("2026-02-01"),
    plannedEndDate: date("2026-04-30"),
    progressPercent: 25,
    status: "Op schema",
    isMilestone: false,
    order: 1,
    audit: audit(),
  }
  const planningTwo: PlanningEntry = {
    id: ids.planningTwo,
    projectId: ids.projectOne,
    kind: "Milestone",
    title: "Voorlopige oplevering",
    plannedEndDate: date("2026-12-31"),
    progressPercent: 0,
    status: "Niet gestart",
    isMilestone: true,
    order: 2,
    audit: audit(),
  }
  const dependency: PlanningDependency = {
    id: ids.dependency,
    predecessorPlanningId: ids.planningOne,
    successorPlanningId: ids.planningTwo,
    type: "FinishToStart",
    audit: audit(),
  }
  const budget: BudgetRecord = {
    id: ids.budget,
    projectId: ids.projectOne,
    topicId: ids.topic,
    category: "Werken",
    type: "Raming",
    description: "Synthetische raming",
    amountCents: 12_345_678,
    date: date("2026-01-31"),
    status: "Goedgekeurd",
    reference: "RAM-TEST-001",
    supplierActorId: ids.actor,
    audit: audit(),
  }

  records.chapters.push(chapter)
  records.clusters.push(cluster)
  records.actors.push(actor)
  records.projects.push(projectOne, projectTwo)
  records.topics.push(topic)
  records.planning.push(planningOne, planningTwo)
  records.planningDependencies.push(dependency)
  records.budgets.push(budget)
  records.config.push(config())
  return records
}

async function exportRecords(
  records: DomainCollections,
  fileName: string,
): Promise<ArrayBuffer> {
  const result = await exporter.export(normalizeDomainState(records), {
    fileName,
  })
  await writeFile(
    resolve(outputDirectory, fileName),
    new Uint8Array(result.buffer),
  )
  return result.buffer
}

async function mutateWorkbook(
  source: ArrayBuffer,
  fileName: string,
  mutate: (workbook: ExcelJS.Workbook) => void,
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(source as never)
  mutate(workbook)
  const written = await workbook.xlsx.writeBuffer()
  await writeFile(resolve(outputDirectory, fileName), new Uint8Array(written))
}

function table(
  workbook: ExcelJS.Workbook,
  worksheetName: string,
  tableName: string,
) {
  return workbook.getWorksheet(worksheetName)?.getTable(tableName)
}

interface LoadedTableModel {
  tableRef: string
  autoFilterRef?: string
  columns: { name: string }[]
}

function tableModel(tableValue: ExcelJS.Table): LoadedTableModel {
  return (tableValue as unknown as { model: LoadedTableModel }).model
}

function columnNumber(letters: string): number {
  return [...letters].reduce(
    (total, letter) => total * 26 + letter.toUpperCase().charCodeAt(0) - 64,
    0,
  )
}

function tableBounds(tableValue: ExcelJS.Table) {
  const model = tableModel(tableValue)
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(model.tableRef)
  if (!match) throw new Error(`Ongeldig tabelbereik ${model.tableRef}.`)
  return {
    startColumn: columnNumber(match[1] ?? "A"),
    startRow: Number(match[2]),
    endColumnLetters: match[3] ?? "A",
    endRow: Number(match[4]),
  }
}

function setTableValue(
  worksheet: ExcelJS.Worksheet,
  tableValue: ExcelJS.Table,
  dataRowIndex: number,
  columnName: string,
  value: ExcelJS.CellValue,
) {
  const model = tableModel(tableValue)
  const bounds = tableBounds(tableValue)
  const columnIndex = model.columns.findIndex(
    (column) => column.name === columnName,
  )
  worksheet
    .getRow(bounds.startRow + 1 + dataRowIndex)
    .getCell(bounds.startColumn + columnIndex).value = value
}

function appendTableRow(
  worksheet: ExcelJS.Worksheet,
  tableValue: ExcelJS.Table,
  values: readonly ExcelJS.CellValue[],
) {
  const model = tableModel(tableValue)
  const bounds = tableBounds(tableValue)
  const newEndRow = bounds.endRow + 1
  values.forEach((value, index) => {
    worksheet.getRow(newEndRow).getCell(bounds.startColumn + index).value =
      value
  })
  const start = model.tableRef.split(":")[0] ?? "A1"
  model.tableRef = `${start}:${bounds.endColumnLetters}${newEndRow}`
  model.autoFilterRef = model.tableRef
}

await mkdir(outputDirectory, { recursive: true })
await exportRecords(emptyRecords(), "empty-valid.xlsx")
const small = await exportRecords(smallRecords(), "small-valid.xlsx")

await mutateWorkbook(small, "duplicate-guid.xlsx", (workbook) => {
  const projects = table(workbook, "Projecten", "tblProjecten")
  if (!projects) throw new Error("tblProjecten ontbreekt.")
  const worksheet = workbook.getWorksheet("Projecten")
  if (!worksheet) throw new Error("Projecten ontbreekt.")
  setTableValue(worksheet, projects, 1, "guid", ids.projectOne)
})

await mutateWorkbook(small, "broken-reference.xlsx", (workbook) => {
  const projects = table(workbook, "Projecten", "tblProjecten")
  if (!projects) throw new Error("tblProjecten ontbreekt.")
  const worksheet = workbook.getWorksheet("Projecten")
  if (!worksheet) throw new Error("Projecten ontbreekt.")
  setTableValue(worksheet, projects, 0, "hoofdstuk-guid", ids.unknown)
})

await mutateWorkbook(small, "invalid-topic-parent.xlsx", (workbook) => {
  const topics = table(workbook, "Topics", "tblTopics")
  if (!topics) throw new Error("tblTopics ontbreekt.")
  const worksheet = workbook.getWorksheet("Topics")
  if (!worksheet) throw new Error("Topics ontbreekt.")
  setTableValue(worksheet, topics, 0, "cluster-guid", ids.cluster)
})

await mutateWorkbook(small, "planning-cycle.xlsx", (workbook) => {
  const dependencies = table(
    workbook,
    "PlanningAfhankelijkheden",
    "tblPlanningAfhankelijkheden",
  )
  if (!dependencies) throw new Error("tblPlanningAfhankelijkheden ontbreekt.")
  const worksheet = workbook.getWorksheet("PlanningAfhankelijkheden")
  if (!worksheet) throw new Error("PlanningAfhankelijkheden ontbreekt.")
  const bounds = tableBounds(dependencies)
  const templateRow = tableModel(dependencies).columns.map(
    (_, index) =>
      worksheet.getRow(bounds.startRow + 1).getCell(bounds.startColumn + index)
        .value,
  )
  templateRow[0] = ids.reverseDependency
  templateRow[1] = ids.planningTwo
  templateRow[2] = ids.planningOne
  appendTableRow(worksheet, dependencies, templateRow)
})

await mutateWorkbook(small, "invalid-budget.xlsx", (workbook) => {
  const budgets = table(workbook, "Budget", "tblBudget")
  if (!budgets) throw new Error("tblBudget ontbreekt.")
  const worksheet = workbook.getWorksheet("Budget")
  if (!worksheet) throw new Error("Budget ontbreekt.")
  setTableValue(worksheet, budgets, 0, "bedrag", 123.456)
})

await mutateWorkbook(small, "small-valid.xlsx", (workbook) => {
  const worksheet = workbook.addWorksheet("NietBeheerd", {
    views: [{ showGridLines: false }],
  })
  worksheet.mergeCells("A1:D1")
  worksheet.getCell("A1").value = "Niet-beheerd synthetisch werkblad"
  worksheet.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" } }
  worksheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF00594C" },
  }
  worksheet.getCell("A3").value = "Doel"
  worksheet.getCell("B3").value = "Bewijs voor best-effort preservation"
  worksheet.getCell("A4").value = "Bron"
  worksheet.getCell("B4").value = "Uitsluitend synthetische testdata"
  worksheet.getCell("A5").value = "Controlewaarde"
  worksheet.getCell("B5").value = "BEHOUD-MIJ-2026"
  worksheet.getColumn("A").width = 24
  worksheet.getColumn("B").width = 40
})
