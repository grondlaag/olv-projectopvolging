# Architectuur — OLV Projectopvolging

## Doel

Frontend-only static web application op GitHub Pages.

De architectuur scheidt:

- domein;
- use cases;
- presentatie;
- opslag;
- Excelmapping.

## Runtime

```text
GitHub Pages
└─ HTML/CSS/JS
   └─ React
      ├─ browser state
      ├─ IndexedDB
      ├─ File API
      ├─ Web Workers
      └─ Excel import/export
```

Geen backendruntime.

## Stack

Voorkeur:

- React;
- TypeScript strict;
- Vite;
- React Router;
- Zustand;
- TanStack Query waar nuttig;
- React Hook Form;
- Zod;
- ExcelJS 4.x voor browser-side `.xlsx` parsing, named tables en export;
- IndexedDB adapter;
- Vitest;
- React Testing Library;
- Playwright;
- ESLint;
- Prettier.

Controleer voor libraries:

- browsercompatibiliteit;
- licentie;
- onderhoud;
- bundle impact;
- toegankelijkheid;
- GitHub Pages-compatibiliteit.

## Routing

Gebruik hash-based routing.

Voorbeeld:

```text
https://account.github.io/repository/#/portfolio
https://account.github.io/repository/#/projects/<guid>
```

Gebruik bij voorkeur `createHashRouter` of `HashRouter`.

## Vite base

Voor project Pages:

```text
/repository-name/
```

Configureer:

```ts
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
})
```

Workflow zet:

```text
VITE_BASE_PATH=/<repository-name>/
```

Geen root-absolute assets.

## Mappenstructuur

```text
src/
  app/
    routing/
    providers/
    state/
  domain/
    entities/
    value-objects/
    rules/
    repositories/
  application/
    commands/
    queries/
    use-cases/
    services/
  infrastructure/
    excel/
      import/
      export/
      schema/
      migrations/
      workers/
    indexed-db/
    repositories/
  features/
    dashboard/
    portfolio/
    projects/
    clusters/
    topics/
    updates/
    actions/
    planning/
    budget/
    meetings/
    reports/
    actors/
    choice-lists/
    settings/
  design-system/
    components/
    tokens/
    patterns/
  validation/
  utils/
  tests/
```

## Lagen

### Domain

- entiteiten;
- invarianten;
- pure businessfuncties;
- repositoryinterfaces.

Kent geen React, Excel of IndexedDB.

### Application

- use cases;
- commands;
- queries;
- aggregaties;
- import/export orchestration.

### Infrastructure

- Excel parsing/writing;
- schema;
- migrations;
- IndexedDB;
- Web Workers;
- repositoryimplementaties.

### UI

- routes;
- schermen;
- forms;
- filters;
- Gantt;
- budgetvisualisaties.

## State

Scheid:

### Domain state

Persistente records.

### UI state

- selectie;
- filters;
- sortering;
- panel widths;
- scrollpositie.

### Session state

- bestandsnaam;
- workbook fingerprint;
- schema-versie;
- dirty flag;
- laatste export;
- herstelbaar concept.

Fase 2 bewaart de actieve, bevestigde workbook-sessie in de centrale Zustand
app-state. Een importresultaat is eerst `pending` en wordt pas na zichtbare
validatiebevestiging de actieve domain state. Portfoliofilters leven eveneens in
app-state en worden gespiegeld naar hashroute-queryparameters.

## IndexedDB

Gebruik voor:

- sessieherstel;
- conceptstate;
- eventueel originele workbookbuffer;
- sessiemetadata.

Niet als verborgen alternatieve productiebron naast Excel.

De fase-2-adapter bewaart één lokale autosnapshot met:

- genormaliseerbare domain records;
- originele workbookbuffer;
- bestands- en schemametadata;
- dirty-state;
- laatste exporttijd.

Na reload wordt de snapshot niet stilzwijgend geactiveerd: de shell toont een
herstelprompt. Excel blijft het canonical exportformaat; IndexedDB is alleen
sessieherstel.

## Excel processing

Grote operaties mogen naar Web Worker na profiling.

De fase-1-implementatie gebruikt `ExcelJS` uitsluitend in
`src/infrastructure/excel`. Het centrale contract staat in
`src/infrastructure/excel/schema/excel-schema.ts`. De technische
`#/dev/excel`-route wordt lazy geladen, zodat de Excelbundle niet in de initiële
appchunk terechtkomt. Een Web Worker-seam bestaat, maar verplaatsing gebeurt pas
na profiling.

```text
UI
→ Worker
→ Excel processing
→ normalized result
```

## Repositoryinterfaces

Minimaal:

- ChapterRepository;
- ClusterRepository;
- ProjectRepository;
- ProjectClusterHistoryRepository;
- ActorRepository;
- TopicRepository;
- UpdateRepository;
- ActionRepository;
- ActionHistoryRepository;
- EvidenceRepository;
- PlanningRepository;
- PlanningDependencyRepository;
- BudgetRepository;
- BudgetMutationRepository;
- MeetingRepository;
- MeetingParticipantRepository;
- AgendaItemRepository;
- ReportRepository;
- ReportItemRepository;
- ChoiceListRepository;
- ConfigRepository;
- LogRepository.

## Indices

Bouw na import:

```text
projectById
clusterById
topicById
actorById
meetingById
updatesByObject
actionsByObject
actionById
actionsByOwner
actionsByProject
actionHistoryByAction
planningByProject
planningByTopic
budgetByProject
budgetByTopic
meetingParticipantById
agendaItemById
reportById
reportItemById
updatesByMeeting
actionsByMeeting
meetingParticipantsByMeeting
agendaItemsByMeeting
reportsByMeeting
reportItemsByReport
meetingsByProject
```

Geen volledige scans vanuit renderlogica.

Fase 9 voegt `meetingsByProject` toe als afgeleide index voor het operationele
projectoverzicht. Project-, cluster- en hoofdstukoverleg wordt tijdens één
indexpassage aan de betrokken projecten gekoppeld; portfolio-overleg blijft
bewust globaal.

Globaal zoeken is een application query over actieve records. De UI stelt de
invoer uit met React `useDeferredValue`, begrenst het resultaat en navigeert
rechtstreeks naar het bronrecord. Relationele context wordt via GUID-indices
opgelost; componenten voeren geen geneste GUID-scans uit.

De root-Reactboom heeft een globale error boundary. Die bewaart lokale data,
toont herstelacties en laat technische details alleen in development zien.

Na profiling is de bestaande Excel-workerseam geactiveerd. Import en export
draaien in een kortlevende moduleworker. `NormalizedDomainState` en werkboekbytes
gaan via structured clone/transfer; de worker wordt na iedere operatie beëindigd.
De applicatie- en domeinlagen blijven van ExcelJS onafhankelijk. Een dynamische
fallbackadapter is uitsluitend bedoeld voor runtimes zonder Web Worker.

Fase-2-queryservices bouwen dashboard- en portfoliomodellen in één passage over
topics, acties en planning. React rendert deze modellen gememoized en voert geen
relationele lookupscan per projectrij uit.

Fase 3 voegt projectmutaties toe via `ProjectManagementService` in de
applicatielaag. Project-, cluster- en actorformulieren houden invoer lokaal met
React Hook Form en voeren pas bij expliciet opslaan een mutation uit. De service
valideert hoofdstuk/cluster- en actorrelaties, schrijft auditvelden en verwerkt
project-clusterhistoriek atomair. Zustand vervangt daarna uitsluitend de
genormaliseerde domain state binnen de actieve werkbooksessie en zet de sessie
dirty; Excel wordt niet automatisch gedownload.

Voor het projectdossier zijn ook `updateById`, `topicsByProject` en
`projectClusterHistoryByProject` onderdeel van de na import/save opgebouwde
indices. Daardoor hoeft een dossier bij render geen volledige recordcollecties
te doorzoeken.

Fase 4 voegt `topicsByCluster` toe en gebruikt de bestaande
`updatesByObject`, `actionsByObject`, `planningByTopic` en `budgetByTopic` voor
de topicwerkruimte. `TopicManagementService` voert creatie, statusovergangen en
append-only journaalmutaties uit. Formulieren blijven lokaal in React Hook Form;
normalisatie en het opnieuw opbouwen van indices gebeuren uitsluitend na een
expliciete save of een bewuste statusactie, nooit per toetsaanslag.

De productiehashroutes omvatten nu ook:

```text
#/projects/<projectId>/topics/<topicId>
#/clusters/<clusterId>
#/clusters/<clusterId>/topics/<topicId>
```

Projectjournaal- en topicselecties worden als gememoized viewmodels opgebouwd
uit de GUID-indices. Topicbudget blijft na fase 6 uitsluitend read-only context;
planningmutaties lopen vanaf fase 6 via de applicatielaag.

Fase 5 voegt `ActionManagementService` toe. Deze service valideert de getypeerde
project-, cluster-, topic- of overlegcontext en de actieve eigenaar, normaliseert
afronden/heropenen en schrijft wijzigingen aan eigenaar, deadline, status en
prioriteit append-only naar `ActionHistory`. React Hook Form houdt quick-input
en inline actorinvoer lokaal; de genormaliseerde state wordt pas na expliciet
opslaan vervangen en dirty gezet.

`actionsByProject` wordt bij iedere import of mutation eenmaal opgebouwd uit
directe projectacties, projecttopicacties en projectoverleg. Het projectdossier,
portfolio en dashboard gebruiken diezelfde index, zodat topicacties niet dubbel
worden geteld. `actionsByOwner` en `actionHistoryByAction` ondersteunen de
globale eigenaarweergave en historie zonder relationele renderscans.

De productiehashroutes omvatten vanaf fase 5 ook de volwaardige werklijst:

```text
#/actions
```

De actielijst filtert afgeleide deadlines (achterstallig, deze week en komende
14 dagen) in gememoized querymodellen. Achterstalligheid is geen persistente
status.

Fase 6 voegt `PlanningManagementService` en pure planningregels toe. De service
maakt en wijzigt `PlanningEntry`, bewaakt maximaal één primaire entry per topic
en valideert finish-to-start-afhankelijkheden op bestaan, self-link,
projectgrens, duplicaat en cyclus. `hasPlanningDependencyCycle` is dezelfde pure
domeinfunctie die de Excel-importgrens gebruikt.

De genormaliseerde indices bevatten aanvullend `planningById`,
`planningDependencyById`, `planningDependenciesByPredecessor` en
`planningDependenciesBySuccessor`. Gantt-querymodellen doen daardoor geen
geneste GUID-scans. Layoutcoördinaten worden gememoized en de planningroutes
worden als afzonderlijke Vite-chunk geladen.

De productiehashroutes omvatten vanaf fase 6:

```text
#/planning
#/projects/<projectId>/planning
```

De renderer uit ADR-009 gebruikt semantische DOM-controls, CSS-balken en een
niet-interactieve SVG-overlay voor dependencies. Alle datumbewerkingen blijven
formuliergebaseerd; drag/drop en automatische projectvoortgang zijn bewust niet
geïmplementeerd.

Fase 7 voegt `BudgetManagementService` en pure budgetledgerregels toe. De
service valideert de vaste projectcontext, project/topicconsistentie, actieve
leverancier en integer cents. Nieuwe financiële feiten worden pas bij
expliciete save toegevoegd. Een foutcorrectie schrijft een append-only
`BudgetMutation` en actualiseert het bestaande bedrag zonder de historie te
verwijderen.

De genormaliseerde indices bevatten aanvullend `budgetById`,
`budgetMutationById` en `budgetMutationsByBudgetRecord`. Project- en
portfolioquery's gebruiken `budgetByProject` en `budgetByTopic` en bouwen hun
viewmodels gememoized. Een topicrecord blijft hetzelfde projectrecord en wordt
nooit nogmaals opgeteld.

De productiehashroutes omvatten vanaf fase 7:

```text
#/budget
#/projects/<projectId>/budget
```

De budgetroutes worden als afzonderlijke Vite-chunk geladen. Financiële
kernaggregaties waarvoor ADR-006 geen status- of samenhangregel bepaalt,
leveren een getypeerde `business-rule-required`-uitkomst in plaats van een
impliciete financiële aanname.

Fase 8 voegt `MeetingManagementService` en `UpdateManagementService` toe. De
centrale domeinregel `validateMeetingScope` bewaakt portfolio-, hoofdstuk-,
cluster- en projectscope aan zowel de mutatie- als Excelgrens. Dezelfde
relevantieregel bepaalt welke bestaande projecten, clusters, topics en acties
op de agenda mogen komen. Suggesties zijn uitsluitend afgeleide queryresultaten
uit bestaande topic- en actievelden en worden pas na een expliciete keuze
opgeslagen.

Updates en beslissingen gebruiken één gedeelde update-use-case en behouden de
broncontext plus `meetingId`. Acties gebruiken de bestaande
`ActionManagementService` met `sourceMeetingId`; topics gebruiken de bestaande
topicflow. De overlegmodule heeft dus geen parallel Update-, Decision-, Action-
of Topic-model. Definitief maken bouwt onveranderlijke `ReportItem`-snapshots.
Een latere correctie maakt een nieuwe oplopende integer-versie; bestaande
definitieve snapshots worden niet gemuteerd (ADR-010).

De genormaliseerde state bevat per-recordindices en gegroepeerde indices voor
deelnemers, agenda, overlegbijdragen, acties, verslagen en verslagitems. De
overleg- en projectquery's gebruiken deze indices, zodat React geen volledige
collecties scant per render. Formulierinvoer blijft lokaal en mutaties gebeuren
alleen bij opslaan of een expliciete contextactie.

De productiehashroutes omvatten vanaf fase 8:

```text
#/meetings
#/meetings/new
#/meetings/<meetingId>
#/meetings/<meetingId>/edit
```

De overlegroutes worden als afzonderlijke Vite-chunk geladen. De
verslagweergave is semantische HTML met print-CSS; browserprint levert de
MVP-PDF zonder serverruntime of PDF-library.

## Deployment

```text
npm ci
npm run verify
npm run build
```

Output:

```text
dist/
```

Alleen `dist/` wordt gepubliceerd.

## Privacy

Geen:

- echte workbooks in Git;
- secrets in Vite env;
- echte data in fixtures;
- telemetry zonder expliciete beslissing;
- netwerktransmissie van workbookdata in MVP.

## O365 later

Conceptueel:

```text
ExcelRepository
→ SharePointRepository
```

UI en use cases blijven zoveel mogelijk gelijk.
