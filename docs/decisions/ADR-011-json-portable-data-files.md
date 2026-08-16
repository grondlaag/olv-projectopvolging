# ADR-011 — JSON als draagbaar operationeel gegevensbestand

Status: Accepted

Datum: 2026-08-16

## Context

De Exceladapter vereiste named tables, een zware browserbundle, specifieke
weergavekenmerken en best-effortbehoud van workbookfeatures. In de praktijk kon
een export daardoor onleesbaar of moeilijk herstelbaar aanvoelen, terwijl de app
zelf al met een genormaliseerd domeinmodel werkte. Een nieuwe lege werkruimte en
instellingenbeheer mochten bovendien niet afhankelijk blijven van een vooraf
opgebouwd workbook.

De productieapp moet statisch op GitHub Pages blijven draaien, alle bestaande
domeinlogica en GUID-relaties behouden en zonder backend bruikbaar zijn.

## Beslissing

- maak `.json` het enige operationele open/save-formaat in de productie-UI;
- gebruik een strikte, versieerbare envelope met formaatsignatuur, schema,
  appversie, dataSetId en alle 22 domeincollecties;
- valideer eerst met Zod en daarna met gecentraliseerde domeinintegriteitsregels;
- schrijf leesbare UTF-8 JSON met integer cents en ongewijzigde ISO-datums;
- bied een nieuwe gegevensset aan zonder vereist bronbestand;
- behoud normalized state, UUID v4, dirty state en IndexedDB-herstel;
- migreer sessiesnapshot naar versie 2 zonder workbookbuffer;
- verwijder de Excelroute en alle Excelacties uit de productierouter;
- behoud de bestaande Exceladapter voorlopig uitsluitend voor synthetische
  legacy-regressie en een eventuele expliciete conversietool;
- documenteer en test `open → mutate → save → reopen → semantic compare` als
  nieuw canonical roundtripcontract.

ADR-002 wordt vervangen als operationeel contract. ADR-007 wordt vervangen voor
de productie-integratie. ADR-008 blijft gelden met de hierboven beschreven v2-
snapshot.

## Gevolgen

Voordelen:

- bestanden zijn leesbaar in gewone teksteditors en niet afhankelijk van
  spreadsheetweergave;
- alle records en relaties worden zonder kolom-/worksheetmapping bewaard;
- nieuwe werkruimtes en instellingen zijn zelfstandig bruikbaar;
- productie heeft geen Excel-worker of ExcelJS-chunk meer;
- roundtripvalidatie is eenvoudiger en sneller;
- JSON kan later als expliciet migratieformaat naar O365 dienen.

Kosten en beperkingen:

- JSON is geen eindgebruikersrapport of spreadsheetanalyseformaat;
- bestaande operationele workbooks vragen een afzonderlijke conversiestap;
- onbekende toekomstige schemaversies moeten expliciet worden gemigreerd;
- het volledige bestand wordt bij openen en opslaan in browsergeheugen gehouden;
  profiling bepaalt of later een Worker/streamingvariant nodig is.
