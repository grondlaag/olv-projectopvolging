import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { AppProviders } from "./app/providers/app-providers"
import { createAppRouter } from "./app/routing"
import { GlobalErrorBoundary } from "./design-system/components"
import "./styles.css"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Het applicatieroot-element ontbreekt.")
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <GlobalErrorBoundary>
        <RouterProvider router={createAppRouter()} />
      </GlobalErrorBoundary>
    </AppProviders>
  </StrictMode>,
)
