import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "./button"
import "./components.css"

interface GlobalErrorBoundaryProps {
  children: ReactNode
}

interface GlobalErrorBoundaryState {
  error: Error | null
}

export class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  state: GlobalErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(error, info)
  }

  private retry = () => this.setState({ error: null })

  private dashboard = () => {
    window.location.hash = "#/dashboard"
    this.retry()
  }

  private restore = () => window.location.reload()

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="global-error" id="main-content">
        <p className="global-error__eyebrow">Veilige herstelmodus</p>
        <h1>Dit onderdeel kon niet worden weergegeven</h1>
        <p>
          De lokale gegevens zijn niet automatisch verwijderd. Probeer het
          onderdeel opnieuw, ga terug naar het dashboard of laad de bewaarde
          browsersessie opnieuw.
        </p>
        <div className="global-error__actions">
          <Button onClick={this.retry}>Opnieuw proberen</Button>
          <Button variant="secondary" onClick={this.dashboard}>
            Terug naar dashboard
          </Button>
          <Button variant="tertiary" onClick={this.restore}>
            Lokale sessie herstellen
          </Button>
        </div>
        {import.meta.env.DEV ? (
          <details>
            <summary>Technische details voor ontwikkeling</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        ) : null}
      </main>
    )
  }
}
