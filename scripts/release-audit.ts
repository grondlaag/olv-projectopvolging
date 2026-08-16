import { readdir, readFile, stat } from "node:fs/promises"
import { extname, relative, resolve } from "node:path"

const root = process.cwd()
const excludedDirectories = new Set([
  ".git",
  "node_modules",
  "playwright-report",
  "test-results",
])

async function filesBelow(directory: string): Promise<string[]> {
  const result: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) result.push(...(await filesBelow(path)))
    if (entry.isFile()) result.push(path)
  }
  return result
}

function normalizedPath(path: string) {
  return relative(root, path).replaceAll("\\", "/")
}

const repositoryFiles = await filesBelow(root)
const sourceFiles = repositoryFiles.filter(
  (path) =>
    normalizedPath(path).startsWith("src/") &&
    !normalizedPath(path).startsWith("src/tests/") &&
    [".ts", ".tsx", ".js", ".jsx"].includes(extname(path)),
)
const sourceText = (
  await Promise.all(
    sourceFiles.map(async (path) => ({
      path: normalizedPath(path),
      text: await readFile(path, "utf8"),
    })),
  )
).flatMap(({ path, text }) =>
  text.split(/\r?\n/u).map((line, index) => ({
    path,
    line: index + 1,
    text: line,
  })),
)

const forbiddenNetwork =
  /\b(fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|EventSource\s*\(|sendBeacon\s*\()/u
const networkFindings = sourceText.filter(({ text }) =>
  forbiddenNetwork.test(text),
)
const productionSpreadsheetFindings = repositoryFiles
  .map(normalizedPath)
  .filter((path) => /\.(xlsx|xlsm|xls)$/iu.test(path))
  .filter((path) => !path.startsWith("src/tests/fixtures/excel/"))
const portableDataFiles = (
  await Promise.all(
    repositoryFiles
      .filter((path) => extname(path).toLowerCase() === ".json")
      .map(async (path) => ({
        path: normalizedPath(path),
        text: await readFile(path, "utf8"),
      })),
  )
)
  .filter(({ text }) => text.includes('"format": "olv-projectopvolging"'))
  .map(({ path }) => path)
const operationalDataFindings = portableDataFiles.filter(
  (path) => !path.startsWith("src/tests/fixtures/json/"),
)
const environmentFindings = repositoryFiles
  .map(normalizedPath)
  .filter((path) => /(^|\/)\.env($|\.)/u.test(path) && path !== ".env.example")
const secretPattern =
  /(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|(?:api[_-]?key|client[_-]?secret|password)\s*[:=]\s*["'][^"']{12,}["'])/iu
const secretFindings = sourceText.filter(({ text }) => secretPattern.test(text))
const nonSyntheticEmails = sourceText.filter(({ text }) => {
  const emails = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu) ?? []
  return emails.some(
    (email) =>
      !email.endsWith("@example.test") &&
      !email.endsWith("@example.invalid") &&
      !email.endsWith(".test") &&
      !email.endsWith(".invalid"),
  )
})
const distributionFiles = await stat(resolve(root, "dist"))
  .then(() => filesBelow(resolve(root, "dist")))
  .catch(() => [])
const distributionSpreadsheets = distributionFiles
  .map(normalizedPath)
  .filter((path) => /\.(xlsx|xlsm|xls)$/iu.test(path))
const distributionDataFiles = portableDataFiles.filter((path) =>
  path.startsWith("dist/"),
)

const findings = {
  onverwachtNetwerkverkeer: networkFindings,
  operationeleSpreadsheets: productionSpreadsheetFindings,
  operationeleJsonGegevensbestanden: operationalDataFindings,
  omgevingsbestanden: environmentFindings,
  mogelijkeSecrets: secretFindings,
  nietSynthetischeEmailsInRuntime: nonSyntheticEmails,
  spreadsheetsInProductiebuild: distributionSpreadsheets,
  jsonGegevensbestandenInProductiebuild: distributionDataFiles,
}
const findingCount = Object.values(findings).reduce(
  (total, items) => total + items.length,
  0,
)
console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      checkedRuntimeFiles: sourceFiles.length,
      checkedRepositoryFiles: repositoryFiles.length,
      findingCount,
      findings,
    },
    null,
    2,
  ),
)
if (findingCount) process.exitCode = 1
