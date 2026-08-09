import { Badge, EmptyState, PageHeader } from "../../design-system/components"
import "./technical-page.css"

interface TechnicalPageProps {
  title: string
  eyebrow: string
  description: string
}

export function TechnicalPage({
  title,
  eyebrow,
  description,
}: TechnicalPageProps) {
  return (
    <div className="technical-page">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={<Badge tone="info">Nog niet beschikbaar</Badge>}
      />

      <div className="technical-page__content">
        <EmptyState
          title="Nog niet beschikbaar"
          description="Deze module staat bewust niet in fase 2. Dashboard, portfolio en read-only projectnavigatie blijven wel beschikbaar."
        />
      </div>
    </div>
  )
}
