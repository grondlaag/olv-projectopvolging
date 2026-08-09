import type { CellValue, Table, Worksheet } from "exceljs"

interface ExcelJsTableModel {
  name: string
  ref?: string
  tableRef?: string
  headerRow?: boolean
  totalsRow?: boolean
  columns: { name: string }[]
}

interface DecodedRange {
  startRow: number
  startColumn: number
  endRow: number
  endColumn: number
}

export interface ExcelTableData {
  name: string
  ref: string
  columns: readonly string[]
  rows: readonly (readonly CellValue[])[]
}

export function getExcelJsTableModel(table: Table): ExcelJsTableModel {
  return (table as unknown as { model: ExcelJsTableModel }).model
}

function columnNumber(letters: string): number {
  return [...letters.toUpperCase()].reduce(
    (total, letter) => total * 26 + letter.charCodeAt(0) - 64,
    0,
  )
}

function decodeRange(ref: string): DecodedRange {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(ref)
  if (!match) throw new Error(`Ongeldig Excel-tabelbereik: ${ref}`)
  return {
    startColumn: columnNumber(match[1] ?? "A"),
    startRow: Number(match[2]),
    endColumn: columnNumber(match[3] ?? "A"),
    endRow: Number(match[4]),
  }
}

export function readExcelTable(
  worksheet: Worksheet,
  table: Table,
): ExcelTableData {
  const model = getExcelJsTableModel(table)
  const ref = model.tableRef ?? model.ref
  if (!ref) throw new Error(`Tabel ${model.name} heeft geen geldig bereik.`)
  const range = decodeRange(ref)
  const dataStartRow = range.startRow + (model.headerRow === false ? 0 : 1)
  const dataEndRow = range.endRow - (model.totalsRow ? 1 : 0)
  const rows: CellValue[][] = []

  for (let rowNumber = dataStartRow; rowNumber <= dataEndRow; rowNumber += 1) {
    const row: CellValue[] = []
    for (
      let columnNumberValue = range.startColumn;
      columnNumberValue <= range.endColumn;
      columnNumberValue += 1
    ) {
      row.push(worksheet.getRow(rowNumber).getCell(columnNumberValue).value)
    }
    rows.push(row)
  }

  return {
    name: model.name,
    ref,
    columns: model.columns.map((column) => column.name),
    rows,
  }
}
