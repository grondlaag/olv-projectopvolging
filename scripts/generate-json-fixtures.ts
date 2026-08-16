import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { BrowserExcelWorkbookGateway } from "../src/infrastructure/excel/excel-workbook-gateway"
import { JsonDataFileGateway } from "../src/infrastructure/json/json-data-file-gateway"

const sourcePath = resolve(
  process.cwd(),
  "src/tests/fixtures/excel/small-valid.xlsx",
)
const outputDirectory = resolve(process.cwd(), "src/tests/fixtures/json")
const targetPath = resolve(outputDirectory, "small-valid.json")

const bytes = await readFile(sourcePath)
const sourceBuffer = bytes.buffer.slice(
  bytes.byteOffset,
  bytes.byteOffset + bytes.byteLength,
)
const legacyGateway = new BrowserExcelWorkbookGateway()
const imported = await legacyGateway.importBuffer(
  sourceBuffer,
  "small-valid.xlsx",
)
if (imported.hasBlockingIssues) {
  throw new Error("De synthetische Excelbron bevat blokkerende fouten.")
}

const exported = new JsonDataFileGateway().export(imported.state)
const fixture = JSON.parse(exported.text) as { exportedAt: string }
fixture.exportedAt = "2026-01-15T09:30:00.000Z"
await mkdir(outputDirectory, { recursive: true })
await writeFile(targetPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8")
console.log(`JSON-fixture geschreven: ${targetPath}`)
