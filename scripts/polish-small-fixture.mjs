import fs from "node:fs/promises"
import path from "node:path"
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool"

const fixturePath = path.resolve("src/tests/fixtures/excel/small-valid.xlsx")
const previewDirectory = path.resolve("test-results/excel-fixture-previews")
const input = await FileBlob.load(fixturePath)
const workbook = await SpreadsheetFile.importXlsx(input)
const notes = workbook.worksheets.getOrAdd("NietBeheerd", {
  renameFirstIfOnlyNewSpreadsheet: true,
})

notes.showGridLines = false
notes.getRange("A1:D1").merge()
notes.getRange("A1").values = [["Niet-beheerd synthetisch werkblad"]]
notes.getRange("A1:D1").format = {
  fill: "#004C3F",
  font: { bold: true, color: "#FFFFFF", size: 14 },
  horizontalAlignment: "left",
  verticalAlignment: "center",
  rowHeight: 28,
}
notes.getRange("A3:B5").values = [
  ["Doel", "Bewijs voor best-effort preservation"],
  ["Bron", "Uitsluitend synthetische testdata"],
  ["Controlewaarde", "BEHOUD-MIJ-2026"],
]
notes.getRange("A3:A5").format = {
  fill: "#DCEDEC",
  font: { bold: true, color: "#18302C" },
}
notes.getRange("A3:B5").format.wrapText = true
notes.getRange("A3:A5").format.columnWidth = 22
notes.getRange("B3:B5").format.columnWidth = 38

const overview = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 6000,
  tableMaxRows: 3,
  tableMaxCols: 8,
  tableMaxCellChars: 80,
})
if (!overview.ndjson)
  throw new Error("De workbookinspectie leverde geen resultaat op.")

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "fixture formula error scan",
})
if (!formulaErrors.ndjson)
  throw new Error("De formulefoutscan leverde geen resultaat op.")

await fs.mkdir(previewDirectory, { recursive: true })
for (const sheetName of ["Projecten", "Budget", "Config", "NietBeheerd"]) {
  const preview = await workbook.render({
    sheetName,
    autoCrop: "all",
    scale: 1,
    format: "png",
  })
  await fs.writeFile(
    path.join(previewDirectory, `${sheetName}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  )
}

const exported = await SpreadsheetFile.exportXlsx(workbook)
await exported.save(path.join(previewDirectory, "small-valid-preview.xlsx"))
