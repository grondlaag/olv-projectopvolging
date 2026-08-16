import { useState, type ChangeEvent } from "react"
import { useNavigate } from "react-router-dom"
import { jsonDataFileService } from "../../app/providers/data-file-services"
import { useAppStore } from "../../app/state/app-store"
import type { DataValidationLevel } from "../../application/services"
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
} from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import "./workbook-import-panel.css"

const levelTone: Record<DataValidationLevel, "danger" | "warning" | "info"> = {
  Blocking: "danger",
  Warning: "warning",
  Info: "info",
}

function userImportError(cause: unknown): string {
  if (
    cause instanceof Error &&
    cause.message === "Selecteer een .json-bestand."
  ) {
    return cause.message
  }
  return "Het JSON-bestand kon niet lokaal worden gelezen. Controleer het bestand en probeer opnieuw."
}

export function DataFilePanel() {
  const navigate = useNavigate()
  const open = useAppStore((state) => state.importPanelOpen)
  const dirty = useAppStore((state) => state.dirty)
  const pendingSession = useAppStore((state) => state.pendingSession)
  const setOpen = useAppStore((state) => state.setImportPanelOpen)
  const setPendingSession = useAppStore((state) => state.setPendingSession)
  const confirmPendingSession = useAppStore(
    (state) => state.confirmPendingSession,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEscapeKey(() => {
    setPendingSession(undefined)
    setError(undefined)
    setOpen(false)
  }, open)

  if (!open) return null

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(undefined)
    setPendingSession(undefined)
    try {
      setPendingSession(await jsonDataFileService.importFile(file))
    } catch (cause) {
      setError(userImportError(cause))
    } finally {
      setBusy(false)
      event.target.value = ""
    }
  }

  function startNewDataSet() {
    setError(undefined)
    setPendingSession(jsonDataFileService.createNewSession())
  }

  function close() {
    setPendingSession(undefined)
    setError(undefined)
    setOpen(false)
  }

  function confirm() {
    confirmPendingSession()
    navigate(pendingSession?.origin === "new" ? "/settings" : "/dashboard")
  }

  const issueCounts = new Map<DataValidationLevel, number>()
  for (const issue of pendingSession?.issues ?? []) {
    issueCounts.set(issue.level, (issueCounts.get(issue.level) ?? 0) + 1)
  }
  const recordCount = pendingSession
    ? Object.values(pendingSession.state.records).reduce(
        (total, collection) => total + collection.length,
        0,
      )
    : 0

  return (
    <div className="workbook-panel__backdrop">
      <section
        className="workbook-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-file-panel-title"
      >
        <header className="workbook-panel__header">
          <div>
            <p>Lokale gegevensbron</p>
            <h2 id="data-file-panel-title">JSON-gegevensbestand</h2>
          </div>
          <Button variant="tertiary" onClick={close} aria-label="Sluiten">
            Sluiten
          </Button>
        </header>

        <div className="workbook-panel__intro">
          <p>
            Open een eerder opgeslagen OLV-gegevensbestand of start een nieuwe
            lege gegevensset. Alles blijft uitsluitend in deze browser.
          </p>
          {dirty ? (
            <p className="workbook-panel__warning" role="status">
              De huidige sessie bevat nog niet opgeslagen wijzigingen. Een
              andere gegevensset vervangt die pas na jouw bevestiging.
            </p>
          ) : null}
          <div className="workbook-panel__actions">
            <label className="workbook-panel__file">
              JSON-bestand kiezen
              <input
                type="file"
                accept=".json,application/json"
                onChange={(event) => void importFile(event)}
              />
            </label>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={startNewDataSet}
            >
              Nieuwe gegevensset
            </Button>
          </div>
        </div>

        {busy ? <LoadingState label="JSON lokaal controleren…" /> : null}
        {error ? <ErrorState description={error} /> : null}

        {pendingSession ? (
          <div className="workbook-panel__report">
            <div className="workbook-panel__report-heading">
              <div>
                <p>Gegevenscontrole</p>
                <h3>{pendingSession.fileName}</h3>
              </div>
              <span>
                Schema {pendingSession.schemaVersion} · {recordCount} records
              </span>
            </div>
            <div className="workbook-panel__badges">
              {(["Blocking", "Warning", "Info"] as const).map((level) => (
                <Badge tone={levelTone[level]} key={level}>
                  {level}: {issueCounts.get(level) ?? 0}
                </Badge>
              ))}
            </div>
            <ul className="workbook-panel__issues">
              {pendingSession.issues.slice(0, 12).map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  <Badge tone={levelTone[issue.level]}>{issue.level}</Badge>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
            {!pendingSession.issues.length ? (
              <p className="workbook-panel__valid">
                Geen problemen gevonden. Het bestand kan veilig worden geopend.
              </p>
            ) : null}
            <footer className="workbook-panel__footer">
              <span>
                {pendingSession.hasBlockingIssues
                  ? "Los de blokkerende gegevensfouten op vóór het openen."
                  : "Na bevestiging wordt dit de actieve lokale sessie."}
              </span>
              <Button
                disabled={pendingSession.hasBlockingIssues}
                onClick={confirm}
              >
                {pendingSession.origin === "new"
                  ? "Gegevensset starten"
                  : "Bestand openen"}
              </Button>
            </footer>
          </div>
        ) : null}
      </section>
    </div>
  )
}
