# OLV Projectopvolging

OLV Projectopvolging is een volledig lokale React-app voor portfolio-, project-,
topic-, actie-, planning-, budget- en overlegopvolging. Een draagbaar
`.json`-bestand is de operationele gegevensbron; GitHub Pages levert uitsluitend
de statische app.

## Gebruik

1. Open de applicatie en kies **JSON openen**.
2. Open een bestaand OLV-gegevensbestand of kies **Nieuwe gegevensset**.
3. Beheer hoofdstukken, clusters, actoren en keuzelijsten via **Instellingen**.
4. Werk in dashboard, portfolio en dossiers.
5. Kies **JSON opslaan** om alle wijzigingen als lokaal bestand te downloaden.

Het bestand wordt met Zod en domeincontroles gevalideerd voordat het de actieve
sessie wordt. Niet-opgeslagen wijzigingen worden als dirty state getoond en als
herstelsnapshot in IndexedDB bewaard. Er wordt geen projectdata naar een server
verstuurd.

## Ontwikkelen

```bash
npm install
npm run dev
```

Kwaliteitscontrole:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run test:e2e
npm run audit:performance
npm run audit:release
```

Een synthetische JSON-fixture kan reproduceerbaar worden opgebouwd met:

```bash
npm run fixtures:json
```

## Architectuur

```text
React UI
  → application services en queries
  → domeinentiteiten en invarianten
  → JSON- en IndexedDB-adapters
```

De JSON-adapter staat onder `src/infrastructure/json`. De historische
Exceladapter blijft geïsoleerd onder `src/infrastructure/excel` voor bestaande
synthetische regressie- en migratietests, maar is niet verbonden met de
productierouter en komt niet in de productieflow terecht. Financiële bedragen
blijven integer cents.

Operationele `.json`-bestanden, echte persoonsgegevens en screenshots met echte
data horen nooit in Git. De fixture onder `src/tests/fixtures/json` is volledig
synthetisch.

## Documentatie

- [Productbrief](docs/product-brief.md)
- [Architectuur](docs/architecture.md)
- [Domeinmodel](docs/domain-model.md)
- [JSON-datacontract](docs/json-contract.md)
- [Visual design](docs/visual-design.md)
- [Planning en budget](docs/planning-and-budget.md)
- [Teststrategie](docs/testing.md)
- [GitHub Pages deployment](docs/github-pages-deployment.md)
- [O365-migratie](docs/o365-migration.md)
