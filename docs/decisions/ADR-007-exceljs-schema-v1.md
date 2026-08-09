# ADR-007 — ExcelJS en centraal schema 1.0.0

Status: Accepted

## Context

Fase 1 vereist volledig lokale `.xlsx`-import en -export in een statische
GitHub Pages-app. De library moet browser-side ArrayBuffers kunnen lezen en
schrijven en echte Excel named tables ondersteunen. Domein en UI mogen geen
werkblad- of kolomkennis krijgen.

## Beslissing

- gebruik ExcelJS 4.x uitsluitend in de Excel-infrastructuuradapter;
- definieer schema `1.0.0` centraal in
  `src/infrastructure/excel/schema/excel-schema.ts`;
- gebruik één beheerde named table per beheerd werkblad;
- valideer eerst structuur en rijen, daarna relaties, vóór state bruikbaar is;
- schrijf financiële waarden vanuit integer cents als numerieke Excelbedragen;
- vervang beheerde werkbladen bij export en behoud onbekende werkbladen
  best-effort;
- vergelijk roundtrips semantisch op genormaliseerde domeinstate;
- laad de tijdelijke Excelroute lazy om de initiële appbundle klein te houden.

## Gevolgen

- de 22 tabel- en kolommappings hebben één bron van waarheid;
- React en domeinentiteiten blijven onafhankelijk van ExcelJS;
- `.xlsx` werkt zonder backend, secrets of netwerkverkeer;
- onbekende eenvoudige werkbladen kunnen worden behouden, maar VBA, shapes,
  pivots, complexe styles en externe links blijven zonder garantie;
- de lazy Excelroutechunk is relatief groot en wordt pas na profiling verder
  opgesplitst of naar een Web Worker verplaatst;
- een toekomstige librarywissel blijft beperkt tot de infrastructuurlaag, maar
  named-tablegedrag vereist opnieuw roundtrip- en preservationtests.
