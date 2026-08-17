# Architectuur — OLV Projectopvolging

## Beslissing

De productieapp is een statische React/TypeScript/Vite-frontend met hashrouting.
Een versieerbaar JSON-bestand is de draagbare gegevensbron. IndexedDB bewaart een
herstelsnapshot van de actieve sessie. Er is geen backend of netwerkafhankelijkheid.

```text
GitHub Pages
  └─ React UI
       ↓
     application services / use cases / queries
       ↓
     domain entities + invarianten
       ↓
     infrastructure
       ├─ JSON data-file adapter
       ├─ browser download adapter
       └─ IndexedDB session adapter
```

## Runtimecontract

- React 19 + TypeScript;
- Vite-build naar `dist/`;
- `createHashRouter` voor alle routes;
- Zustand voor de actieve genormaliseerde sessie;
- React Hook Form + Zod voor complexe formulieren;
- Zod voor gegevensbestanden aan de infrastructuurgrens;
- File API, Blob-download en IndexedDB;
- geen SSR, API-routes, Node-runtime of browsersecrets.

Het operationele bestand wordt alleen op expliciete gebruikersactie geopend of
gedownload. GitHub Pages ontvangt nooit de inhoud.

## Modules en afhankelijkheidsrichting

### UI

`src/features`, `src/design-system` en `src/app` bevatten routes, pagina's,
presentatiecomponenten en lokale formulierstate. UI-componenten kennen geen
JSON-envelope en schrijven niet rechtstreeks naar IndexedDB.

Belangrijke features:

- dashboard en portfolio;
- project- en clusterbeheer;
- topics, updates, beslissingen en acties;
- planning en Gantt;
- budget;
- overleg en verslag;
- instellingen;
- gegevensbestand openen/opslaan.

### Application

`src/application/services` bevat mutaties, sessiecontracten, integriteitscontrole
en bestandsports. `src/application/queries` bouwt viewmodellen via geïndexeerde
state. Mutaties ontvangen een state en leveren een nieuwe genormaliseerde state
plus het gewijzigde record terug.

Belangrijke services:

- `DataFileService` en `DataFileGateway`;
- `SettingsManagementService`;
- project-, topic-, actie-, planning-, budget- en overlegservices;
- `validateDomainIntegrity`;
- sessiesnapshot en semantische vergelijking.

### Domain

`src/domain` bevat entiteiten, enums en pure invarianten. Deze laag kent geen
React, bestandsformaat, browseropslag of downloadmechanisme. UUID, datums,
auditvelden, relaties en integer cents blijven domeinconcepten.

### Infrastructure

- `src/infrastructure/json`: strikte envelope, Zod-schema en JSON-gateway;
- `src/infrastructure/files`: browserdownload;
- `src/infrastructure/indexed-db`: herstelsnapshots;
- `src/infrastructure/excel`: geïsoleerde legacyadapter voor synthetische
  regressie- en eventuele expliciete migratietests.

De legacy-Exceladapter is niet gekoppeld aan de productierouter, header of
bestandsflow. De tijdelijke ontwikkelroute is verwijderd en ExcelJS wordt door
tree-shaking niet in de productie-assets opgenomen.

## Gegevensbestand

Het contract staat in [json-contract.md](json-contract.md). De envelope bevat:

- formaatsignatuur;
- schemaversie;
- exporttijd en appversie;
- stabiele dataSetId;
- alle 22 domeincollecties.

Import verloopt als volgt:

```text
File.text()
  → JSON.parse
  → strict Zod envelope
  → relationele domeincontrole
  → genormaliseerde state en indices
  → bevestiging door gebruiker
  → actieve sessie
```

Syntax-, schema- en relatieproblemen worden concreet en Nederlandstalig getoond.
Blocking issues verhinderen openen. Er is geen silent repair.

Opslaan verloopt als volgt:

```text
actieve genormaliseerde state
  → integriteitscontrole
  → strict envelope
  → leesbare UTF-8 JSON met 2-spatie-inspringing
  → Blob-download
  → dirty state wissen
```

De domeinarrays worden volledig geschreven; afgeleide Maps en viewmodellen niet.
De export is daardoor menselijk inspecteerbaar en semantisch reproduceerbaar.

## Centrale state

De store bevat minimaal:

- actieve `DataFileSession`;
- eventuele nog te bevestigen sessie;
- bestandsnaam en schemaversie;
- genormaliseerde records en indices;
- validatieissues;
- dirty state en laatste opslagtijd;
- herstelcandidate;
- UI-filters en status van het bestandspaneel.

De state is genormaliseerd. Belangrijke indices omvatten onder andere records per
GUID, projects/topics/actions/planning/budgetten per parent en overleg per scope.
Queries gebruiken deze indices en memoiseerbare viewmodellen; ze voeren geen
geneste GUID-scans bij elke render uit.

### Persoonlijke werkruimtevoorkeuren

Niet-operationele voorkeuren leven in een afzonderlijke, versievaste
`localStorage`-store (`olv-projectopvolging.workspace-preferences.v1`). Deze
bevat uitsluitend:

- benoemde weergaven als pagina + genormaliseerde hash-query;
- recente en favoriete links naar project-, topic- en overlegdossiers;
- tabeldichtheid en verborgen kolommen.

Deze voorkeuren bevatten geen domeinrecords, worden nooit aan de
genormaliseerde sessie toegevoegd, zetten de dirty state niet en komen niet in
JSON of IndexedDB-sessiesnapshots terecht. Een onleesbare voorkeurenset valt
veilig terug op standaardwaarden; het operationele gegevensbestand blijft
onaangeroerd.

Agenda-items zijn daarnaast geïndexeerd per bronobject. De contextuele
overlegplanner voor project en topic leest daardoor bestaande koppelingen via
`agendaItemsByObject` en maakt met de bestaande overlegservice pas bij expliciete
save een nieuw `AgendaItem`. Een expliciet gekoppeld portfolio-overleg wordt via
`meetingsByProject` ook in het bijbehorende projectdossier zichtbaar.

## Sessies en herstel

De applicatieservice accepteert voor nieuwe of bewerkte agendapunten uitsluitend
een project- of topicbron. Het persistente schema houdt bronvelden optioneel om
historische vrije punten verliesloos te openen; de UI markeert die als legacy en
vraagt om herkoppeling. Queryfuncties bouwen gegroepeerde agenda- en
contextjournaalmodellen uit bestaande indices. PDF-opbouw en rich-textkopie
leven in de client-side bestandsinfrastructuur en muteren geen domeinstate.

IndexedDB-snapshot versie 2 bewaart:

- bestandsnaam en schema;
- alle domeincollecties;
- validatiestatus;
- dirty state en laatste opslagtijd.

De JSON-file blijft de draagbare source of truth; IndexedDB is alleen lokaal
crash-/refreshherstel. Een aangetroffen versie-1-snapshot uit de voormalige
Excelperiode kan nog worden genormaliseerd en wordt daarna aangeboden als
`*_hersteld.json`, zonder een workbookbuffer verder te bewaren.

## Instellingen en structuurbeheer

`#/settings` is een volwaardige lazy-loaded route. Alle wijzigingen lopen via
`SettingsManagementService` en vervangen de state pas bij expliciete save.
Hoofdstuk-, cluster-, actor- en keuzelijstcodes worden gevalideerd; deactivatie
mag bestaande actieve relaties niet verbreken.

Het projectformulier hergebruikt dezelfde hoofdstukservice en bestaande project-
en actorservices voor inline creatie. `flushSync` zorgt dat het nieuwe record in
de genormaliseerde state staat voordat React Hook Form het GUID selecteert. De
overige, nog niet opgeslagen formulierwaarden blijven lokale form state.

## Mutatie- en auditregels

- Elk persistent record krijgt UUID v4.
- Complexe formulieren muteren pas bij expliciete save.
- Elke mutation bouwt incremental een nieuwe normalized state.
- Projectclusterwijziging sluit de open historie en opent zo nodig een nieuwe.
- Current updates wijzen naar een eigen actief update-record.
- Een update-auteur is een expliciet gekozen actieve actor. De huidige actor
  blijft, indien actief, de auditactor; anders neemt de gekozen auteur die rol
  voor de lokale mutatie over.
- Actie-, budget- en verslaghistoriek wordt niet stilzwijgend overschreven.
- Dirty state wordt gezet na elke domeinmutatie en pas gewist na een geslaagde
  JSON-download.

De dashboardactie-status en de snelle projectupdate roepen bestaande
applicatieservices aan. Invoer blijft lokale componentstate tot expliciete save.
De commandolaag navigeert alleen en houdt returnTo bij; zij maakt zelf geen
records. Portfolio-presets en chips zijn projecties op PortfolioFilters en
worden in hash-queryparameters gespiegeld. Hetzelfde contract geldt voor
instellingentabs, overlegmodus en -filters, actieweergave, planningsfilters en
-zoom en budgetfilters en -groepering; alleen tijdelijke formulier- en
drawerstate blijft lokale componentstate.

De contextgevoelige creatielaag zet alleen bestaande GUID-context in tijdelijke
hash-queryparameters. Project- en clustertopics, acties en overlegformulieren
lezen die context als voorinvulling; de bestaande application service valideert
de relatie opnieuw bij expliciete save. Actie-invoer gebruikt een veilige
`returnTo`, zodat bewaren of annuleren terugkeert naar het brondossier.

Bulkbewerking is voorlopig beperkt tot acties. De UI verzamelt een zichtbare
selectie en past eigenaar en/of status pas na één expliciete bevestiging toe.
Iedere actie blijft via de bestaande `ActionManagementService` lopen, zodat
actiehistoriek en domeinvalidatie behouden blijven; de store wordt pas na de
volledige geslaagde reeks vervangen.

## Financiële architectuur

Bedragen worden als integer cents opgeslagen. `BudgetRecord.projectId` is
verplicht; `topicId` is slechts een optionele relatie naar hetzelfde record.
Projectaggregaties tellen de records dus één keer. Correcties maken
`BudgetMutation`-historiek. Pure aggregatiefuncties leveren project- en
portfolioresultaten.

## Routing en GitHub Pages

Voorbeelden:

```text
#/dashboard
#/portfolio
#/projects/new
#/projects/:projectId
#/projects/:projectId/edit
#/projects/:projectId/overview
#/projects/:projectId/topics
#/projects/:projectId/topics/:topicId
#/projects/:projectId/journal
#/projects/:projectId/planning
#/projects/:projectId/budget
#/clusters/:clusterId
#/actions
#/planning
#/budget
#/meetings
#/settings
```

Alle projectonderdelen gebruiken dezelfde dossierkop en dezelfde volledige
projecteditor. Een veilige `returnTo`-parameter bewaart de bronroute bij
bewerken; externe of protocolrelatieve terugkeerpaden worden geweigerd.
Complexe project- en overlegformulieren blokkeren interne navigatie zolang de
invoer vuil is en waarschuwen ook bij het sluiten of herladen van het venster.
Vervolgoverleggen gebruiken `?vervolgVan=<meetingId>` als tijdelijke
formuliercontext en bewaren na save een domeinrelatie via `sourceMeetingId`.

Vite `base` gebruikt de repositorybase. Assets worden via imports geladen; er
zijn geen root-absolute URLs of serverrewrites nodig.

## Performance

- JSON wordt eenmaal bij openen geparsed, niet bij renders.
- Formulierkeypresses muteren de repository niet.
- Relaties worden via Maps en parentindices gelezen.
- Grote featurebundels zijn lazy geladen.
- Gantt- en portfolioviews gebruiken gecentraliseerde selectors.
- Een Web Worker wordt pas toegevoegd wanneer profiling aantoont dat JSON-parse
  of validatie op representatieve datasets de UI merkbaar blokkeert.

## Privacy en releasegrenzen

Niet toegestaan:

- operationele JSON-bestanden in Git of `dist`;
- netwerktransmissie van projectrecords;
- private secrets in clientcode;
- backendafhankelijkheid voor kernfunctionaliteit;
- Excel als verborgen tweede productiesource of truth.

De release-audit controleert netwerk-API's, secrets, operationele datafiles,
spreadsheets buiten synthetische legacyfixtures en gegevensbestanden in `dist`.

## Migratiepad naar O365

De UI en applicatieservices blijven afhankelijk van repository-/gatewaycontracten.
Een latere SharePoint-, Graph-, Dataverse- of REST-adapter kan de JSON-gateway
aanvullen of vervangen zonder de domeinregels te herschrijven. Zie
[o365-migration.md](o365-migration.md).
