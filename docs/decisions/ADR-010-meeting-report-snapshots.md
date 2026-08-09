# ADR-010 — Overlegscope en onveranderlijke verslag-snapshots

## Status

Aanvaard.

## Context

Een overleg gebruikt bestaande projecten, clusters, topics, updates,
beslissingen en acties. Een definitief verslag moet tegelijk historisch
betrouwbaar blijven wanneer die bronrecords later veranderen. Een tweede set
overlegspecifieke domeinobjecten zou relaties verdubbelen en bronjournaals uit
elkaar laten lopen.

## Beslissing

- `Meeting.scopeType` en `scopeId` worden door één centrale domeinregel
  gevalideerd. Portfolio heeft geen scope-ID; de andere scopes verwijzen naar
  exact één bestaand record van het overeenkomstige type.
- Agenda-items mogen alleen naar een project, cluster, topic of actie binnen die
  scope verwijzen. Vrije agendapunten hebben geen objectreferentie.
- Updates en beslissingen blijven één `Update` met broncontext en optioneel
  `meetingId`. Acties blijven één `Action` met optioneel `sourceMeetingId`.
- Een verslag krijgt positieve, oplopende integer-versies: 1, 2, 3, …
- Bij conceptopbouw worden `ReportItem`-snapshots gemaakt. Bij definitief maken
  worden status en `finalDate` gezet en wordt de snapshotinhoud niet meer
  gewijzigd.
- Een correctie op een definitief verslag maakt versie `n + 1` met status
  `Gereviseerd` en een correctienotitie. Eerdere versies blijven bestaan.
- Browserprint met print-CSS is de MVP-PDF-route; er komt geen server- of
  client-PDF-afhankelijkheid bij.

## Gevolgen

Het overleg en de brondossiers tonen dezelfde records zonder synchronisatie of
duplicaten. Historische verslagtekst blijft aantoonbaar gelijk wanneer een
topic of actie later wijzigt. Snapshots nemen extra Excelrijen in, maar maken
audit, roundtrip en revisie expliciet. Latere geavanceerde goedkeuring,
ondertekening of documentopslag kan bovenop de versiehistoriek worden gebouwd
zonder het bronmodel te wijzigen.
