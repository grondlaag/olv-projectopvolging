# Releasechecklist — 1.1.0 JSON en instellingen

Datum: 2026-08-16

## Scope

- [x] Productieflow opent en bewaart uitsluitend OLV JSON.
- [x] Hoofdstuk is selecteerbaar en inline aanmaakbaar in projectbeheer.
- [x] Cluster is hoofdstukafhankelijk selecteerbaar en inline aanmaakbaar.
- [x] `#/settings` beheert algemeen, structuur, actoren, keuzelijsten en datafile.
- [x] Topics ondersteunen actieve eigenaars en updates ondersteunen expliciete
  actieve auteurs, inclusief inline actor-aanmaak zonder invoerverlies.
- [x] De globale planning toont dekking, planningitems, mijlpalen,
  aandachtspunten en periode zonder projectselectie.
- [x] Genormaliseerde state, GUIDs, historie, dirty state en IndexedDB-herstel
  blijven behouden.
- [x] Legacy-Excelcode is niet bereikbaar vanuit de productierouter.

## Datacontract

- [x] Appversie `1.1.0`; JSON-schema `1.0.0`.
- [x] Strikte envelope en 22 verplichte collecties.
- [x] UUID, datum, Unicode, booleans, optionele velden en integer cents roundtrip.
- [x] Relationele domeincontrole blokkeert corrupte input en save.
- [x] JSON is leesbaar UTF-8 met twee-spatie-inspringing.
- [x] IndexedDB-snapshot v2 en legacy-v1-herstel zijn getest.

## UX en toegankelijkheid

- [x] Nieuwe gegevensset is mogelijk zonder voorafgaand bestand.
- [x] Projectformuliervelden blijven behouden bij inline beheer.
- [x] Dirty/saved-status en downloadfeedback zijn zichtbaar.
- [x] Instellingen gebruikt secties en compacte zijpanelen, geen modalketen.
- [x] Responsive/toetsenbord Playwright-hoofdflow opnieuw uitgevoerd.

## Automatische checks

- [x] `npm run format:check`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test -- --run` — 27 bestanden, 140 tests.
- [x] `npm run build`
- [x] `npm run test:e2e` — 13 hoofdflows.
- [x] `npm run audit:performance`
- [x] `npm run audit:release`

## Build en privacy

- [x] Geen Excel-worker of ExcelJS-asset in `dist`.
- [x] Geen operationele JSON-data of spreadsheets in `dist`.
- [x] Release-audit heeft nul findings.
- [x] GitHub Pages repositorybase-test is groen.

## Handmatige productcontrole

- [x] Nieuwe gegevensset en Instellingen visueel gecontroleerd.
- [x] Nieuw project met inline hoofdstuk en cluster gecontroleerd.
- [x] JSON-download als leesbare tekst gecontroleerd en opnieuw in de app geopend.
- [ ] Representatief operationeel pilotbestand door producteigenaar gecontroleerd.

De laatste pilotstap blijft een operationele releasevoorwaarde; de repository
bevat uitsluitend synthetische data.

## Auditmeting

De performancetest van 2026-08-16 gebruikte 500 projecten, 5.000 topics,
20.000 acties, 25.000 updates en 25.000 budgetrecords. Het JSON-bestand was
44,88 MB; export duurde 2,31 seconden en validatie/import 12,01 seconden op de
testmachine. Alle collectietellingen bleven gelijk en de import leverde nul
blokkerende problemen op.
