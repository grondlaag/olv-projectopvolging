import { useCallback, useEffect, useRef } from "react"
import { useBlocker } from "react-router-dom"
import { Button } from "../components"

export function useUnsavedFormGuard(isDirty: boolean) {
  const allowNavigationRef = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty &&
      !allowNavigationRef.current &&
      `${currentLocation.pathname}${currentLocation.search}` !==
        `${nextLocation.pathname}${nextLocation.search}`,
  )

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty || allowNavigationRef.current) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warnBeforeUnload)
    return () => window.removeEventListener("beforeunload", warnBeforeUnload)
  }, [isDirty])

  const allowNextNavigation = useCallback(() => {
    allowNavigationRef.current = true
  }, [])

  return { blocker, allowNextNavigation }
}

interface UnsavedFormDialogProps {
  blocker: ReturnType<typeof useUnsavedFormGuard>["blocker"]
}

export function UnsavedFormDialog({ blocker }: UnsavedFormDialogProps) {
  if (blocker.state !== "blocked") return null

  return (
    <div className="form-guard__backdrop">
      <section
        className="form-guard"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="form-guard-title"
        aria-describedby="form-guard-description"
      >
        <span>Niet-bewaarde invoer</span>
        <h2 id="form-guard-title">Deze wijzigingen zijn nog niet toegepast</h2>
        <p id="form-guard-description">
          Als je nu verdergaat, gaat alleen de invoer in dit formulier verloren.
          Eerder bewaarde sessiewijzigingen blijven behouden.
        </p>
        <footer>
          <Button variant="tertiary" onClick={() => blocker.reset()}>
            Verder bewerken
          </Button>
          <Button variant="secondary" onClick={() => blocker.proceed()}>
            Invoer verwerpen
          </Button>
        </footer>
      </section>
    </div>
  )
}
