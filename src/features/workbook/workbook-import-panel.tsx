import { useState, type ChangeEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAppStore } from "../../app/state/app-store"
import type { ExcelValidationLevel } from "../../application/services"
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
} from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import "./workbook-import-panel.css"

const levelTone: Record<
  ExcelValidationLevel,
  "danger" | "warning" | "info" | "success"
> = {
  Blocking: "danger",
  Recoverable: "warning",
  Warning: "warning",
  Info: "info",
}

function userImportError(cause: unknown): string {
  if (
    cause instanceof Error &&
    cause.message === "Selecteer een .xlsx- of .xlsm-bestand."
  )
    return cause.message
  return "Het Excelbestand kon niet lokaal worden gelezen. Controleer het bestandsformaat en probeer opnieuw."
}

export function WorkbookImportPanel() {
  const navigate = useNavigate()
  const open = useAppStore((state) => state.importPanelOpen)
  const pendingImport = useAppStore((state) => state.pendingImport)
  const setOpen = useAppStore((state) => state.setImportPanelOpen)
  const setPendingImport = useAppStore((state) => state.setPendingImport)
  const confirmPendingImport = useAppStore(
    (state) => state.confirmPendingImport,
  )
  const [repairMode, setRepairMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  useEscapeKey(() => {
    setPendingImport(undefined)
    setError(undefined)
    setOpen(false)
  }, open)

  if (!open) return null

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(undefined)
    setPendingImport(undefined)
    try {
      const { excelWorkbookService } =
        await import("../../app/providers/excel-services")
      setPendingImport(await excelWorkbookService.importFile(file, repairMode))
    } catch (cause) {
      setError(userImportError(cause))
    } finally {
      setBusy(false)
      event.target.value = ""
    }
  }

  async function downloadTemplate() {
    setBusy(true)
    setError(undefined)
    try {
      const { excelWorkbookService } =
        await import("../../app/providers/excel-services")
      await excelWorkbookService.downloadTemplate()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Het lege sjabloon kon niet worden gemaakt.",
      )
    } finally {
      setBusy(false)
    }
  }

  function close() {
    setPendingImport(undefined)
    setError(undefined)
    setOpen(false)
  }

  function confirm() {
    confirmPendingImport()
    navigate("/dashboard")
  }

  const issueCounts = new Map<ExcelValidationLevel, number>()
  for (const issue of pendingImport?.issues ?? []) {
    issueCounts.set(issue.level, (issueCounts.get(issue.level) ?? 0) + 1)
  }

  return (
    <div className="workbook-panel__backdrop">
      <section
        className="workbook-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workbook-panel-title"
      >
        <header className="workbook-panel__header">
          <div>
            <p>Lokale gegevensbron</p>
            <h2 id="workbook-panel-title">Excelbestand laden</h2>
          </div>
          <Button variant="tertiary" onClick={close} aria-label="Sluiten">
            Sluiten
          </Button>
        </header>

        <div className="workbook-panel__intro">
          <p>
            Het bestand wordt uitsluitend in deze browser gelezen. Importeer pas
            na controle van het validatierapport.
          </p>
          <div className="workbook-panel__actions">
            <label className="workbook-panel__file">
              Bestand kiezen
              <input
                type="file"
                accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
                onChange={(event) => void importFile(event)}
              />
            </label>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void downloadTemplate()}
            >
              Leeg sjabloon downloaden
            </Button>
          </div>
          <label className="workbook-panel__repair">
            <input
              type="checkbox"
              checked={repairMode}
              onChange={(event) => setRepairMode(event.target.checked)}
            />
            Veilige herstelmodus gebruiken
          </label>
        </div>

        {busy ? <LoadingState label="Workbook lokaal controleren…" /> : null}
        {error ? <ErrorState description={error} /> : null}

        {pendingImport ? (
          <div className="workbook-panel__report">
            <div className="workbook-panel__report-heading">
              <div>
                <p>Importcontrole</p>
                <h3>{pendingImport.fileName}</h3>
              </div>
              <span>
                Schema {pendingImport.schemaVersion ?? "onbekend"} ·{" "}
                {pendingImport.tables.length} tabellen
              </span>
            </div>
            <div className="workbook-panel__badges">
              {(["Blocking", "Recoverable", "Warning", "Info"] as const).map(
                (level) => (
                  <Badge tone={levelTone[level]} key={level}>
                    {level}: {issueCounts.get(level) ?? 0}
                  </Badge>
                ),
              )}
            </div>
            <ul className="workbook-panel__issues">
              {pendingImport.issues
                .filter((issue) => issue.level !== "Info")
                .slice(0, 12)
                .map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>
                    <Badge tone={levelTone[issue.level]}>{issue.level}</Badge>
                    <span>{issue.message}</span>
                  </li>
                ))}
            </ul>
            {!pendingImport.issues.some((issue) => issue.level !== "Info") ? (
              <p className="workbook-panel__valid">
                Geen problemen gevonden. Dit workbook kan worden geïmporteerd.
              </p>
            ) : null}
            <footer className="workbook-panel__footer">
              <span>
                {pendingImport.hasBlockingIssues
                  ? "Los blokkerende fouten op vóór import."
                  : "Na bevestiging wordt dit de actieve lokale sessie."}
              </span>
              <Button
                disabled={pendingImport.hasBlockingIssues}
                onClick={confirm}
              >
                Import bevestigen
              </Button>
            </footer>
          </div>
        ) : null}
      </section>
    </div>
  )
}
