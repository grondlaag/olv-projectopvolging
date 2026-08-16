# AGENTS.md — OLV Projectopvolging

## Projectdoel

Deze repository bevat **OLV Projectopvolging**: een client-side webapplicatie voor projectopvolging in een zorg- en bouwcontext.

De toepassing ondersteunt:

- dashboard en portfolio;
- hoofdstukken en clusters;
- projecten;
- project- en clustertopics;
- actuele stand, updates en beslissingen;
- acties en actiehistoriek;
- planning en Gantt;
- budgetopvolging;
- overleg, agenda en verslag;
- actoren en configureerbare keuzelijsten;
- JSON-import, validatie en export;
- een geïsoleerde legacy-Exceladapter voor regressie- en migratietests.

**Plan-pin, interactieve plannen en PDF/SVG-pinfunctionaliteit zijn niet in scope.**

## Hosting- en runtimecontract

De productieversie wordt gehost via **GitHub Pages**.

Versie 1 is daarom strikt een **statische frontend**:

- React + TypeScript + Vite;
- geen backendserver;
- geen API-routes;
- geen server actions;
- geen SSR-runtime;
- geen Node filesystem-API's in productie;
- geen serverdatabase;
- geen browsersecrets;
- geen verplichte externe cloudservice.

Alle JSON-data wordt lokaal in de browser verwerkt.

GitHub Pages host alleen applicatiecode en statische assets. Operationele JSON-gegevensbestanden mogen nooit in repository of Pages-build terechtkomen.

Gebruik **hash-based client routing** voor betrouwbare routing op GitHub Pages.

## Bronnen van waarheid

Lees vóór niet-triviale wijzigingen:

1. `docs/product-brief.md`
2. `docs/architecture.md`
3. `docs/domain-model.md`
4. `docs/json-contract.md`
5. `docs/visual-design.md`
6. `docs/planning-and-budget.md`
7. `docs/testing.md`
8. `docs/github-pages-deployment.md`
9. `docs/o365-migration.md`

Architecturale beslissingen staan in `docs/decisions/`.

Los inconsistenties niet stilzwijgend op. Documenteer de gekozen oplossing.

## Werkmethode

Voor elke niet-triviale taak:

1. inspecteer relevante code en documentatie;
2. bepaal welke domeinregels geraakt worden;
3. bepaal regressierisico's;
4. maak een kort implementatieplan;
5. voer de kleinste coherente wijziging uit;
6. schrijf of pas tests aan;
7. voer formatter, lint, typecheck, tests en build uit;
8. actualiseer documentatie indien gedrag of architectuur wijzigt.

Breid werkende subsystemen gericht uit. Vervang ze niet zonder aantoonbare reden.

Implementeer geen toekomstige fase tenzij de taak dit expliciet vraagt.

## Architectuurgrenzen

Verplichte afhankelijkheidsrichting:

```text
React UI
  ↓
Application use cases / services
  ↓
Domain entities + repository interfaces
  ↓
Infrastructure adapters
```

Versie 1:

```text
Infrastructure
  ├─ JSON data-file adapter
  └─ IndexedDB draft/session adapter
```

Later mogelijk:

```text
Infrastructure
  ├─ SharePoint
  ├─ Microsoft Graph
  ├─ Dataverse
  └─ REST API
```

Regels:

- React-componenten parsen of serialiseren het gegevensbestand niet rechtstreeks.
- Domeinentiteiten kennen geen JSON-envelope of bestandsnamen.
- JSON-mapping leeft uitsluitend in `src/infrastructure/json`.
- De legacy-Excelmapping onder `src/infrastructure/excel` is niet bereikbaar vanuit de productierouter.
- Browseropslag is geen domeinlogica.
- UI-state is niet de persisted source of truth.
- Externe data wordt aan de grens gevalideerd met Zod.
- Nieuwe persistente records krijgen UUID v4.
- Financiële berekeningen gebruiken integer cents of decimal-safe rekenlogica.

## Frontend-only regels

Toegestaan:

- File API;
- Blob / ArrayBuffer;
- IndexedDB;
- Web Workers;
- browser downloads;
- object URLs;
- client-side JSON parsing en downloads.

Niet toegestaan als vereiste voor kernfunctionaliteit:

- server filesystem;
- server sessions;
- databaseconnecties;
- private environment secrets;
- backend-API in deze applicatie.

Netwerkverkeer is standaard niet nodig voor de MVP.

## GitHub Pages-regels

- Gebruik Vite.
- Productie-output is `dist/`.
- Deployment loopt via GitHub Actions.
- Pages Source is GitHub Actions.
- Vite `base` is correct voor `/<repository>/`.
- Geen hardcoded root-absolute asset-URL's.
- Gebruik Vite imports of `import.meta.env.BASE_URL`.
- Gebruik hash-routing zodat refresh geen server rewrite nodig heeft.
- Deploy pas nadat checks slagen.

## Domeininvarianten

### Projecten

- project heeft exact één hoofdstuk;
- cluster is optioneel;
- cluster hoort bij één hoofdstuk;
- projectcluster hoort bij hetzelfde hoofdstuk;
- clusterwijziging behoudt historiek.

### Topics

- topic hoort bij exact één project of exact één cluster;
- nooit beide;
- timing is optioneel;
- topic zonder planning verschijnt niet als geplande Gantt-balk;
- topic kan acties, updates, beslissingen en bewijs hebben.

### Updates

- current update hoort rechtstreeks bij hetzelfde bronobject;
- historische updates worden niet overschreven.

### Acties

- actie kan horen bij project, cluster, topic of overleg;
- afgerond vereist afronddatum;
- eigenaar verwijst naar actieve actor;
- wijzigingshistoriek blijft traceerbaar.

### Planning

- project heeft kernplanning op projectniveau;
- topic kan nul of één primaire planningentry hebben;
- vrije mijlpalen zijn aparte planningentries;
- afhankelijkheden staan in een aparte relatietabel;
- geen cycli;
- initieel alleen finish-to-start;
- projectvoortgang is standaard handmatig.

### Budget

- ieder budgetrecord hoort bij één project;
- `topicId` is optioneel;
- topicbudget is dus geen tweede geldrecord;
- correcties zijn traceerbare mutaties;
- financiële historie wordt niet overschreven.

## Gegevensbestandsregels

JSON is een opslagadapter, geen applicatielogica.

Canonical formaat: **`.json`**, volgens `docs/json-contract.md`.

Excel is geen operationeel invoer- of uitvoerformaat meer. De bestaande Exceladapter blijft uitsluitend behouden voor synthetische regressietests en eventuele expliciete migratietools.

Elke substantiële import/exportwijziging vereist:

```text
open JSON
→ domain state
→ wijziging
→ JSON opslaan
→ opnieuw openen
→ semantisch vergelijken
```

Nooit corrupte relaties stilzwijgend accepteren.

## Visual design

Volg `docs/visual-design.md`.

Kernkarakter:

- rustig;
- architecturaal;
- professioneel;
- menselijk;
- redactioneel;
- functioneel;
- geschikt voor zorgcontext.

Vermijd generieke SaaS-stijl, felle gradients, neon, overmatige kaarten, zware shadows en willekeurige inline styles.

## UX-regels

- één klik opent een record;
- essentiële acties vereisen geen dubbelklik;
- behoud context na opslaan;
- inline editing of zijpaneel boven modalstapeling;
- actor en cluster kunnen tijdens invoer toegevoegd worden zonder contextverlies;
- lege conceptregels worden niet opgeslagen;
- complex formulier = expliciete save;
- veilige kleine wijziging = autosave toegestaan met zichtbare status;
- fouten zijn concreet en Nederlandstalig.

## Performance

- geen repeated full-table scans bij elke render;
- geen geneste lineaire GUID-lookups;
- indexeer relaties op GUID;
- memoized selectors;
- incremental index updates;
- virtualiseer grote lijsten/tabellen;
- debounce zoeken;
- lazy-load Gantt;
- grote JSON-bestanden pas na profiling in een Web Worker verwerken.

## Testvereisten

Voor substantiële wijzigingen:

```text
format
lint
typecheck
unit/integration tests
build
```

Playwright bij gewijzigde hoofdflows.

Claim geen geslaagde check zonder hem uit te voeren.

## Documentatie

Werk documentatie mee bij bij wijzigingen aan:

- architectuur;
- domeinregels;
- JSON-contract;
- schema/migratie;
- planning;
- budget;
- deployment;
- routing;
- design system.

Gebruik ADR's voor belangrijke architecturale beslissingen.

## Opleveringsrapport

Rapporteer:

1. wat gewijzigd is;
2. gewijzigde bestanden;
3. belangrijke beslissingen;
4. uitgevoerde commando's;
5. testresultaten;
6. bekende beperkingen;
7. bijgewerkte documentatie;
8. regressiestatus;
9. aanbevolen volgende taak.
