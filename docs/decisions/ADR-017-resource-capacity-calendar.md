# ADR-017 — Capaciteitskalender ingebed in het assetprofiel

## Status

Aanvaard.

## Context

Assetcapaciteit moet rekening houden met een normale werkweek, verlof,
opleiding en deeltijdse beschikbaarheid. Een afzonderlijke globale
kalendercollectie zou voor deze beperkte toepassing extra relatie- en
beheercomplexiteit toevoegen.

## Besluit

- `Resource` krijgt `weeklyCapacityHours` en een lijst auditbare
  `availabilityExceptions`.
- Iedere uitzondering bevat een start- en einddatum, reden en resterend
  beschikbaarheidspercentage.
- Overlappende uitzonderingen gebruiken per dag het laagste percentage.
- De periodecapaciteit is het daggemiddelde van die beschikbaarheid, begrensd
  door zowel project-VTE als weekuren/40.
- Capaciteit kan per week of kalendermaand worden getoond.
- Eén actieve actor kan aan maximaal één actieve personeelsasset gekoppeld zijn.
- Schema 1.1 migreert deterministisch naar 1.2 met 40 uur per VTE en zonder
  uitzonderingen; de 26 top-level collecties veranderen niet.

## Gevolgen

Oude JSON-bestanden blijven verliesloos te openen. De oplossing ondersteunt
geen terugkerende kalenderregels, feestdagenkalender of urenregistratie; zulke
uitbreidingen vereisen later een afzonderlijke beslissing.
