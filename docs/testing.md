# Teststrategie — OLV Projectopvolging

## Testlagen

### Unit

Vitest:

- domeinregels;
- validators;
- aggregaties;
- mappings;
- indices.

### Component

React Testing Library:

- formulieren;
- filters;
- tabellen;
- drawers;
- empty/error states.

### Integration

- repositories;
- Excel importer/exporter;
- IndexedDB;
- migratie;
- planning;
- budget.

### E2E

Playwright voor hoofdflows.

## Kernunit-tests

### Project

- hoofdstuk verplicht;
- cluster optioneel;
- cluster hoort bij hoofdstuk;
- clusterhistoriek.

### Topic

- exact één ouder;
- eigenaar actief;
- current update.

### Actie

- afronddatum;
- status;
- eigenaar;
- historie.

### Planning

- topic zonder planning;
- periode;
- milestone;
- datumvalidatie;
- progress;
- self-link;
- dependency cycle;
- vertraging.

### Budget

- cents;
- aggregaties;
- topic geen dubbeltelling;
- correcties;
- meer/minwerk;
- prognose.

### Overleg

- centrale scope-invariant voor alle vier scopetypes;
- actieve, unieke deelnemers en aanwezigheid;
- vrij en gekoppeld agendapunt binnen scope;
- expliciete agendaorder en herordenen;
- update/beslissing met één gedeeld bronrecord;
- actie met `sourceMeetingId`;
- unieke, oplopende verslagversies;
- onveranderlijke definitieve snapshots en revisie;
- Excelroundtrip van overleg, deelnemers, agenda, bijdragen en verslagen.

## Excel fixtures

Synthetisch:

- `empty-valid.xlsx`;
- `small-valid.xlsx`;
- `duplicate-guid.xlsx`;
- `broken-reference.xlsx`;
- `invalid-topic-parent.xlsx`;
- `planning-cycle.xlsx`;
- `invalid-budget.xlsx`.

Deze zeven fase-1-fixtures staan in `src/tests/fixtures/excel` en worden
reproduceerbaar opgebouwd met `npm run fixtures:excel`. `small-valid.xlsx`
bevat ook het onbekende werkblad `NietBeheerd` voor preservationcontrole.

Latere performance- en migratiefasen voegen afzonderlijk `large-valid.xlsx` en
`legacy-schema.xlsx` toe; deze horen niet bij de fase-1-oplevering.

Geen operationele OLV-data in Git.

## Roundtrip

```text
read ArrayBuffer
→ import
→ normalize
→ mutate
→ export
→ reimport
→ semantic compare
```

Vergelijk:

- IDs;
- aantallen;
- relaties;
- datums;
- bedragen;
- status;
- dependencies;
- audit.

## GitHub Pages routingtest

Build met Pages-base.

Controleer:

- root;
- `#/portfolio`;
- `#/projects/<id>`;
- refresh;
- assets onder subpath;
- geen broken root-absolute assets.

## CI/build

Minimaal:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test -- --run
npm run build
```

## Playwright hoofdflow

Fase 1 automatiseert op `#/dev/excel`:

1. importeer `small-valid.xlsx` via de browser File API;
2. controleer schema, tabellen en nul blocking issues;
3. wijzig een projecttitel;
4. exporteer in memory;
5. herimporteer;
6. verwacht `Semantisch identiek`.

Fase 2 automatiseert in de productie-interface:

1. open `#/dashboard`;
2. laad `small-valid.xlsx` via de lokale File API;
3. controleer het validatierapport en bevestig de import;
4. open portfolio;
5. pas een zoekfilter toe;
6. klik één keer op een typed projectregel;
7. controleer `#/projects/<guid>`;
8. reload;
9. herstel de IndexedDB-sessie;
10. controleer dat dezelfde projectroute geldig blijft.

Fase 3 automatiseert aanvullend in de productie-interface:

1. importeer `small-valid.xlsx`;
2. open portfolio en start een nieuw project;
3. voeg een actieve actor inline toe en selecteer die als coördinator;
4. voeg binnen het gekozen hoofdstuk een cluster inline toe;
5. sla het project expliciet op en controleer dirty state en dossier;
6. bewerk het project zonder de dossiercontext te verliezen;
7. exporteer het workbook via de browserdownload;
8. importeer die export opnieuw;
9. vind en open het project opnieuw;
10. controleer actor, cluster en clusterhistoriek.

De Vitest-laag dekt daarnaast project zonder/met cluster, onverenigbaar
hoofdstuk/cluster, inline actor/cluster, stabiele project-ID, clusterwissel,
clusterverwijdering, open/sluiten van historiek en de semantische Excelroundtrip.

Fase 4 automatiseert aanvullend:

1. importeer `small-valid.xlsx` en open een projectdossier;
2. controleer de projectoverview en open de topicwerkruimte;
3. maak een projecttopic met actieve eigenaar, prioriteit en vaste context;
4. voeg een update toe en stel die in als actuele stand;
5. voeg een afzonderlijke beslissing toe en controleer de newest-first tijdlijn;
6. bekijk dezelfde bijdragen in het gecombineerde projectjournaal;
7. sluit en heropen het topic zonder historie te verliezen;
8. exporteer, herimporteer en vind topic, actuele update en beslissing terug;
9. reload de directe topicroute en herstel de IndexedDB-sessie.

Vitest dekt daarnaast exact één project- of clusterouder, inactieve eigenaar,
stabiele UUID, current-update-invariant, append-only historie, sluiten/heropenen,
zoeken en filters, geïndexeerde actiecounts, dirty state, read-only
actie-uitbreidingspunten en de fase-4-Excelroundtrip.

Fase 5 automatiseert aanvullend:

1. importeer `small-valid.xlsx`, open portfolio, project en topic;
2. start quick-input voor een topicactie;
3. voeg een actieve eigenaar inline toe zonder actie-invoer te verliezen;
4. sla de actie op en controleer dashboardcounters;
5. open `#/actions`, filter en groepeer per eigenaar;
6. wijzig eigenaar, deadline, status en prioriteit;
7. rond de actie af met afronddatum;
8. exporteer en importeer de download opnieuw;
9. vind de afgeronde actie terug in de globale werklijst.

Vitest dekt daarnaast project-, topic- en clustercontext, verplichte actieve
eigenaar, optionele deadline, afgeleide achterstalligheid, afronden/heropenen,
append-only `ActionHistory`, groepering per eigenaar, projectaggregatie zonder
dubbeltelling, dirty state en de fase-5-Excelroundtrip van `tblActies` en
`tblActieHistoriek`.

Fase 6 automatiseert aanvullend:

1. importeer `small-valid.xlsx` en open een projecttopic;
2. voeg topictiming en een projectmijlpaal toe;
3. open de project-Gantt en wissel zoom;
4. voeg een geldige finish-to-start-afhankelijkheid toe;
5. probeer de omgekeerde link en controleer de cyclusmelding;
6. open de globale portfolio-Gantt met `Zonder cluster`;
7. exporteer, herimporteer en vind timing, mijlpaal en dependency terug.

Vitest dekt topic zonder/met één entry, weigering van een tweede primaire
entry, mijlpaal- en periodevalidatie, progressgrenzen, afgeleide vertraging,
self- en cross-projectlinks, pure cyclusdetectie, dirty state, Gantt-routes,
filters en de Excelroundtrip van `tblPlanning` en
`tblPlanningAfhankelijkheden`. Een synthetische test bouwt 500 projecten en
5.000 planningrecords als snelle regressie op het query- en indexpad; de
volledige gedocumenteerde performancefixture blijft bedoeld voor profiling.

Fase 7 automatiseert aanvullend:

1. importeer `small-valid.xlsx` en open het projectbudget;
2. voeg goedgekeurd budget, raming en contract toe;
3. voeg topicgekoppeld meerwerk toe en controleer dat het project dit eenmaal
   bevat;
4. open topicdetail en controleer dezelfde gekoppelde records;
5. open `#/budget`, filter op project en controleer de groepering;
6. corrigeer een bedrag met reden en controleer de append-only historie;
7. exporteer, herimporteer en controleer bedragen, relaties en historie.

Vitest dekt daarnaast centsconversie, Belgische euro-opmaak, percentages en de
nulbudget-edgecase, bedragen per type/status, meer- en minwerk, contingentie,
factuur, betaling, correctie, `BudgetMutation`, topicdubbeltelling, dirty state,
strikte importfouten en de Excelroundtrip van `tblBudget` en
`tblBudgetMutaties`. Tests bewaken expliciet dat de onbesliste kernaggregaties
geen willekeurige uitkomst leveren maar `business-rule-required` blijven.

Fase 8 automatiseert aanvullend:

1. importeer `small-valid.xlsx` en maak een projectoverleg;
2. voeg een bestaand topic, een bestaande actie en een vrij punt aan de agenda
   toe en wijzig de volgorde;
3. registreer aanwezigheid, update, beslissing en nieuwe actie vanuit de
   agendacontext;
4. controleer acties gegroepeerd per eigenaar;
5. bouw en finaliseer versie 1 van het verslag;
6. wijzig het brontopic en controleer dat de historische snapshot gelijk blijft;
7. maak indien nodig revisie 2 zonder versie 1 te overschrijven;
8. exporteer, herimporteer en vind overleg, relaties, versies en snapshots terug.

Vitest dekt daarnaast formulieren en de volledige overlegwerkruimte, dirty
state, project- en dashboardselecties, suggesties zonder persistente afgeleide
velden, scopefouten aan de importgrens en de semantische Excelroundtrip. De
Playwright-hoofdflow controleert dezelfde keten in de browser inclusief
printactie en hashrouting.

Daarnaast bouwt een Vitest-smoke de app met
`base=/olv-projectopvolging/`, leest de gegenereerde `index.html` en verifieert
dat iedere script- en stylesheetreferentie onder dat subpad bestaat.

De volledige producthoofdflow voor latere fasen blijft:

1. importeer fixture;
2. portfolio;
3. project openen;
4. project wijzigen;
5. actor toevoegen;
6. cluster toevoegen;
7. topic toevoegen;
8. topic timing;
9. Gantt;
10. actie;
11. budgetrecord;
12. budgettotalen;
13. export;
14. herimport;
15. vergelijking.

## Performancefixture

- 500 projecten;
- 5.000 topics;
- 25.000 updates;
- 20.000 acties;
- 10.000 planningrecords;
- 25.000 budgetrecords/mutaties.

Meet:

- import;
- portfolio render;
- zoeken;
- projectopen;
- Gantt;
- budgetaggregatie;
- export.

Concrete thresholds na eerste profiling.

## Fase 9 releasehardening

De eerste volledige profiling is op 2026-08-09 uitgevoerd. Diagnostische grenzen
voor dezelfde referentieklasse zijn:

- index- en afzonderlijke querypaden: minder dan 500 ms;
- volledige Excel-export: minder dan 30 s;
- volledige Excel-import: minder dan 180 s;
- heap na import: minder dan 1,2 GB;
- nul blocking issues en exacte collectieaantallen na herimport.

`npm run audit:performance` bouwt de gedocumenteerde grote fixture, meet alle
querypaden en voert een echte export/herimport uit. `npm run audit:release` zoekt
naar onverwacht netwerkverkeer, spreadsheets buiten de synthetische fixturemap,
environmentbestanden, mogelijke secrets, niet-synthetische runtime-e-mails en
Excelbestanden in `dist`.

Aanvullende regressies:

- `phase9-hardening.test.tsx`: globale zoektypen/routes, foutgrens en
  `meetingsByProject`;
- `phase9-excel-hardening.test.ts`: alle collecties en kritieke semantiek in één
  roundtrip;
- `phase9-master-release.spec.ts`: samenhangende hoofdflow door fasen 0–8;
- `phase9-visual-accessibility.spec.ts`: productiepreview op 1920/1440/1280/
  1024/768 px, basissemantiek, overflow en toetsenbordsmoke.

## Accessibility

Automatisch waar mogelijk:

- form labels;
- focus;
- dialogs;
- table headers;
- button names.

Handmatig:

- keyboard hoofdflow;
- zoom;
- contrast;
- screenreader smoke test.

## Regressionbeleid

Iedere opgeloste regressie krijgt waar haalbaar een test.

Extra belangrijk:

- Excelverlies;
- routing;
- GUID-relaties;
- budgetdubbeltelling;
- planningcyclus;
- formuliercontext.

## Deployment smoke test

Na Pages deployment:

- site opent;
- hoofdbundle laadt;
- hashroute werkt;
- import lokaal;
- geen workbookdata naar netwerk;
- exportdownload werkt.
