# OLV Projectopvolging

OLV Projectopvolging 1.0 is een statische, lokale webapp voor dagelijkse
projectopvolging in een zorg- en bouwcontext. De applicatie beheert portfolio,
projectdossiers, topics, actuele standen, beslissingen, acties, planning,
budgetten, overleg en versievaste verslagen. Excel is de draagbare database;
IndexedDB bewaart uitsluitend een herstelbare lokale werksessie.

## Privacy en runtime

- Alle operationele data blijft in de browser.
- Import en export gebeuren client-side; zwaar Excelwerk draait in een Web
  Worker zodat de interface responsief blijft.
- Er is geen backend, API, telemetrie, externe database of browsersecret.
- GitHub Pages bevat alleen de applicatiecode en statische assets.
- Commit nooit operationele Excelbestanden, screenshots met echte data of
  andere vertrouwelijke gegevens.

## Dagelijks gebruik

1. Open de applicatie en kies **Excelbestand laden**.
2. Selecteer een canonical `.xlsx`-bestand en controleer het validatierapport.
3. Bevestig de import en werk vanuit Dashboard, Portfolio of globaal zoeken.
4. Wijzigingen worden expliciet in de lokale sessie opgeslagen. De status
   **Wijzigingen nog niet geëxporteerd** blijft zichtbaar.
5. Kies **Exporteren** om een nieuw werkboek te downloaden. Een edit start nooit
   automatisch een download.

Bij een onverwachte onderbreking biedt de app de IndexedDB-sessie opnieuw aan.
Herstel of verwijder die sessie bewust. Het bronbestand zelf wordt nooit
overschreven.

Globaal zoeken vindt projecten, clusters, topics, actuele standen, updates,
beslissingen, acties en overleg. `Ctrl/Cmd+K` of `/` focust zoeken; pijltjestoetsen
kiezen een resultaat en Enter opent het dossier. Compacte invoer ondersteunt
waar vermeld `Ctrl/Cmd+Enter`; Esc sluit alleen het actieve paneel.

## Ontwikkelen

Vereisten: een actuele Node.js-LTS en npm.

```bash
npm ci
npm run dev
```

Belangrijkste commando's:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run test:e2e
npm run audit:release
npm run audit:performance
```

`npm run verify` voert formattercontrole, lint, typecheck, unit/integratietests en
de productiebuild uit. De performanceaudit gebruikt bewust de maximale
synthetische fixture en kan enkele minuten en circa 1 GB werkgeheugen vragen.

## Architectuur

De verplichte richting blijft:

```text
React UI
  → application services en queries
  → domain entities en regels
  → Excel- en IndexedDB-adapters
```

De productiebuild gebruikt hash-routing en een configureerbare Vite-base voor
GitHub Pages. Excelmapping staat uitsluitend onder
`src/infrastructure/excel`; financiële bedragen gebruiken integer cents.

## Testdata

Alle werkboeken onder `src/tests/fixtures/excel` zijn synthetisch en mogen geen
operationele namen, e-mailadressen of projectinformatie bevatten. `.gitignore`
blokkeert spreadsheets buiten die fixturemap.

## Release en documentatie

- [Releasechecklist](docs/release-checklist.md)
- [UX-audit fase 9](docs/ux-audit-phase9.md)
- [Productbrief](docs/product-brief.md)
- [Architectuur](docs/architecture.md)
- [Domeinmodel](docs/domain-model.md)
- [Excelcontract](docs/excel-contract.md)
- [Visual design](docs/visual-design.md)
- [Teststrategie](docs/testing.md)
- [GitHub Pages deployment](docs/github-pages-deployment.md)

