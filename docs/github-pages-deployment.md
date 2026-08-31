# GitHub Pages deployment

## Contract

De productieapp is een statische Vite-build:

- output: `dist/`;
- routing: hash-based;
- Pages Source: GitHub Actions;
- base: repositorypad;
- geen backend, secrets, API-routes of serverrewrites.

## Vite base

CI zet `VITE_BASE_PATH` op `/<repository>/`. Alle scripts, styles en lazy chunks
worden via Vite-imports opgebouwd. Root-absolute asset-URLs zijn verboden.

Lokale productiecontrole:

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

Controleer minstens:

```text
/#/dashboard
/#/portfolio
/#/settings
/#/projects/:id
/#/planning
/#/budget
/#/meetings
```

Een refresh op een hashroute vraagt alleen `index.html` aan en heeft dus geen
rewrite nodig.

## Workflow

De GitHub Actions-workflow moet achtereenvolgens uitvoeren:

```text
npm ci
format check
lint
typecheck
unit/integration tests
performance-audit
build met repositorybase
release-audit
Playwright Chromium installeren
end-to-end tests
Pages artifact upload
deploy-pages
```

De deployjob publiceert pas nadat ook de release-audit en de volledige
Playwright-hoofdflows slagen.

## JSON-gegevensbestanden

Operationele `.json`-bestanden worden nooit gedeployed. De app wordt zonder data
gebouwd en vraagt de gebruiker lokaal:

- een bestaand OLV-JSON-bestand te openen; of
- een nieuwe gegevensset te starten.

Openen gebruikt `File.text()`; opslaan gebruikt een Blob/object-URL-download.
De JSON-adapter bevat geen fetch of upload. IndexedDB bewaart alleen een lokale
herstelsnapshot op het apparaat van de gebruiker.

De enige toegestane datafile in de repository is de volledig synthetische
testfixture onder `src/tests/fixtures/json`. Ze wordt niet vanuit runtimecode
geïmporteerd en komt niet in `dist`.

## Legacy Excel

De historische Exceladapter en synthetische fixtures blijven broncode/testdata,
maar zijn niet bereikbaar vanuit de productierouter. Er is geen Excel-worker,
ExcelJS-chunk of spreadsheet in `dist`. De Pages smoke-test controleert dit.

## Privacycontrole

Voor deployment:

- `npm run audit:release` heeft nul findings;
- `dist` bevat geen OLV-data-envelope of spreadsheet;
- runtimecode bevat geen onverwachte netwerk-API;
- geen `.env`, tokens, echte e-mailadressen of operationele screenshots;
- de browser Network-tab toont geen transmissie bij JSON openen/opslaan.

## Cache en updates

Vite-assets krijgen content hashes. `index.html` verwijst naar de actuele hashes.
Een nieuwe appversie wijzigt niet automatisch het JSON-schema; appversie en
schemaversie zijn onafhankelijke velden. Onbekende schemas worden geblokkeerd tot
een expliciete migratie beschikbaar is.

## Rollback

Een rollback van de statische app wijzigt geen gebruikersdata op de server, want
die bestaat daar niet. Bewaar voor een releasewisseling wel een kopie van het
laatst geldige JSON-bestand. Open een bestand alleen met een appversie die de
opgegeven `schemaVersion` ondersteunt.

## Handmatige productiecheck

1. open de Pages-URL onder de repositorybase;
2. start een nieuwe gegevensset en open Instellingen;
3. voeg hoofdstuk/cluster toe en maak een project;
4. sla JSON op en open die download opnieuw;
5. controleer dirty/saved-status en refreshherstel;
6. controleer dat routes en lazy chunks onder de base laden;
7. controleer dat geen projectdata in netwerkrequests voorkomt.
