import { useMemo, useState, type ChangeEvent } from "react"
import type {
  ExcelRoundTripResult,
  ExcelValidationLevel,
  ImportedExcelSession,
} from "../../application/services"
import type { UUID } from "../../domain"
import { excelWorkbookService } from "../../app/providers/excel-services"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../design-system/components"
import "./excel-development-page.css"

interface FileDetails {
  name: string
  size: number
}

const levelTone: Record<
  ExcelValidationLevel,
  "danger" | "warning" | "info" | "success"
> = {
  Blocking: "danger",
  Recoverable: "warning",
  Warning: "warning",
  Info: "info",
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function statusLabel(result?: ExcelRoundTripResult): string {
  if (!result) return "Nog niet uitgevoerd"
  if (result.reimported.hasBlockingIssues)
    return "Herimport bevat blokkerende fouten"
  return result.comparison.equal
    ? "Semantisch identiek"
    : `${result.comparison.differences.length} verschil(len) gevonden`
}

export function ExcelDevelopmentPage() {
  const [session, setSession] = useState<ImportedExcelSession>()
  const [fileDetails, setFileDetails] = useState<FileDetails>()
  const [repairMode, setRepairMode] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [roundTrip, setRoundTrip] = useState<ExcelRoundTripResult>()
  const setLoadedFile = useAppStore((state) => state.setLoadedFile)
  const setDirty = useAppStore((state) => state.setDirty)

  const issueCounts = useMemo(() => {
    const counts = new Map<ExcelValidationLevel, number>()
    for (const issue of session?.issues ?? []) {
      counts.set(issue.level, (counts.get(issue.level) ?? 0) + 1)
    }
    return counts
  }, [session])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setIsBusy(true)
    setError(undefined)
    setRoundTrip(undefined)
    try {
      const imported = await excelWorkbookService.importFile(file, repairMode)
      setSession(imported)
      setFileDetails({ name: file.name, size: file.size })
      setLoadedFile(file.name)
      setDirty(false)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Excelimport is mislukt.",
      )
    } finally {
      setIsBusy(false)
      event.target.value = ""
    }
  }

  function updateProjectTitle(projectId: UUID, title: string) {
    if (!session) return
    try {
      const state = excelWorkbookService.updateProjectTitle(
        session.state,
        projectId,
        title,
      )
      setSession({ ...session, state })
      setDirty(true)
      setRoundTrip(undefined)
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wijziging is mislukt.")
    }
  }

  async function exportWorkbook() {
    if (!session) return
    setIsBusy(true)
    setError(undefined)
    try {
      await excelWorkbookService.exportAndDownload(
        session.state,
        session.sourceBuffer,
      )
      setDirty(false)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Excelexport is mislukt.",
      )
    } finally {
      setIsBusy(false)
    }
  }

  async function verifyRoundTrip() {
    if (!session) return
    setIsBusy(true)
    setError(undefined)
    try {
      setRoundTrip(
        await excelWorkbookService.verifyRoundTrip(
          session.state,
          session.sourceBuffer,
        ),
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Roundtripcontrole is mislukt.",
      )
    } finally {
      setIsBusy(false)
    }
  }

  async function downloadTemplate() {
    setIsBusy(true)
    setError(undefined)
    try {
      await excelWorkbookService.downloadTemplate()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Sjabloonexport is mislukt.",
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="excel-dev">
      <PageHeader
        eyebrow="Tijdelijke development harness"
        title="Excel roundtrip"
        description="Technische controle van het canonical .xlsx-contract. Dit is geen definitieve productinterface."
        actions={<Badge tone="info">Fase 1</Badge>}
      />

      <section className="excel-dev__toolbar" aria-label="Excelbestand kiezen">
        <label className="excel-dev__file-button">
          Excel kiezen
          <input
            type="file"
            accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
            onChange={handleFileChange}
          />
        </label>
        <label className="excel-dev__repair-mode">
          <input
            type="checkbox"
            checked={repairMode}
            onChange={(event) => setRepairMode(event.target.checked)}
          />
          Veilige herstelmodus
        </label>
        <Button
          variant="secondary"
          onClick={downloadTemplate}
          disabled={isBusy}
        >
          Leeg sjabloon
        </Button>
        {session ? (
          <>
            <Button
              onClick={exportWorkbook}
              disabled={isBusy || session.hasBlockingIssues}
            >
              Excel downloaden
            </Button>
            <Button
              variant="secondary"
              onClick={verifyRoundTrip}
              disabled={isBusy || session.hasBlockingIssues}
            >
              Export herimporteren
            </Button>
            <Button
              variant="tertiary"
              onClick={() =>
                excelWorkbookService.downloadBackup(
                  session.sourceBuffer,
                  session.fileName,
                )
              }
              disabled={isBusy}
            >
              Back-up
            </Button>
          </>
        ) : null}
      </section>

      {isBusy ? <LoadingState label="Workbook wordt lokaal verwerkt…" /> : null}
      {error ? <ErrorState description={error} /> : null}

      {!session && !isBusy ? (
        <EmptyState
          title="Nog geen workbook geladen"
          description="Kies een synthetisch of operationeel .xlsx-bestand. De verwerking blijft volledig in deze browser."
        />
      ) : null}

      {session ? (
        <div className="excel-dev__results">
          <section className="excel-dev__panel">
            <h2>Workbook</h2>
            <dl className="excel-dev__metadata">
              <div>
                <dt>Bestandsnaam</dt>
                <dd>{fileDetails?.name ?? session.fileName}</dd>
              </div>
              <div>
                <dt>Bestandsgrootte</dt>
                <dd>{fileDetails ? formatFileSize(fileDetails.size) : "—"}</dd>
              </div>
              <div>
                <dt>Schema-versie</dt>
                <dd>{session.schemaVersion ?? "Niet gevonden"}</dd>
              </div>
              <div>
                <dt>Roundtripstatus</dt>
                <dd>{statusLabel(roundTrip)}</dd>
              </div>
            </dl>
          </section>

          <section className="excel-dev__panel">
            <div className="excel-dev__section-heading">
              <h2>Validatierapport</h2>
              <div className="excel-dev__badges">
                {(["Blocking", "Recoverable", "Warning", "Info"] as const).map(
                  (level) => (
                    <Badge key={level} tone={levelTone[level]}>
                      {level}: {issueCounts.get(level) ?? 0}
                    </Badge>
                  ),
                )}
              </div>
            </div>
            {session.issues.length ? (
              <ul className="excel-dev__issues">
                {session.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>
                    <Badge tone={levelTone[issue.level]}>{issue.level}</Badge>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Geen validatieproblemen gevonden.</p>
            )}
          </section>

          <section className="excel-dev__panel excel-dev__panel--wide">
            <h2>Gevonden tabellen</h2>
            <div className="excel-dev__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tabel</th>
                    <th>Werkblad</th>
                    <th>Records</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {session.tables.map((table) => (
                    <tr key={`${table.worksheetName}-${table.name}`}>
                      <td>{table.name}</td>
                      <td>{table.worksheetName}</td>
                      <td className="excel-dev__number">{table.rowCount}</td>
                      <td>{table.known ? "Beheerd" : "Onbekend"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="excel-dev__panel excel-dev__panel--wide">
            <h2>Eerste projecten</h2>
            {session.state.records.projects.length ? (
              <div className="excel-dev__projects">
                {session.state.records.projects.slice(0, 5).map((project) => (
                  <label key={project.id}>
                    <span>{project.code}</span>
                    <input
                      defaultValue={project.title}
                      onBlur={(event) =>
                        updateProjectTitle(project.id, event.target.value)
                      }
                    />
                  </label>
                ))}
              </div>
            ) : (
              <p>Dit workbook bevat geen projecten.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
