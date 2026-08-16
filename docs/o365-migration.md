# O365-migratiepad

## Huidige situatie

Versie 1.1 gebruikt een lokaal JSON-bestand als draagbare opslagadapter en
IndexedDB voor sessieherstel. De React-UI werkt tegen application services,
genormaliseerde domain state en repository-/gatewaycontracten.

```text
UI
 ↓
Application services en queries
 ↓
Domain + repository interfaces
 ↓
JSONDataFileGateway / IndexedDB
```

Daardoor hoeft een latere O365-adapter geen componenten of domeinregels te
herschrijven.

## Doelopties

Mogelijke infrastructuuradapters:

- SharePoint Lists;
- Microsoft Graph;
- Dataverse;
- een eigen REST API.

De keuze hangt af van aantallen, permissies, transactiebehoefte, auditvereisten,
licenties en beheerorganisatie. Dit document kiest nog geen platform.

## Contractgrenzen

Een remote implementatie moet dezelfde capabilities bieden:

- records per collectie lezen;
- record aanmaken/bijwerken/deactiveren;
- stabiele GUIDs behouden;
- relaties en optimistic concurrency bewaken;
- auditvelden en append-only historie bewaren;
- domeinfouten in dezelfde application-vorm teruggeven;
- financiële integer cents ongewijzigd behandelen.

De UI weet niet of records uit een lokaal JSON-bestand of een remote repository
komen.

## Mapping

Het JSON-contract is het huidige overdrachtscontract. Iedere collectie kan naar
een lijst/tabel worden gemapt, bijvoorbeeld:

```text
projects                 → Projects
projectClusterHistory    → ProjectClusterHistory
topics                   → Topics
updates                  → Updates
actions                  → Actions
actionHistory            → ActionHistory
planning                 → PlanningEntries
planningDependencies     → PlanningDependencies
budgets                  → BudgetRecords
budgetMutations          → BudgetMutations
meetings                 → Meetings
meetingParticipants      → MeetingParticipants
agendaItems              → AgendaItems
reports                  → Reports
reportItems              → ReportItems
```

Foreign keys blijven GUIDs. Current-updateverwijzingen, clusterhistoriek,
budgetmutaties en verslagsnapshots mogen niet worden afgeplat tot ontraceerbare
tekstvelden.

## Authenticatie en beveiliging

De huidige statische app bevat geen secrets. Een O365-versie vereist een aparte
beslissing over:

- Microsoft Entra ID en MSAL;
- delegated versus application permissions;
- tenantconsent;
- record-/lijstautorisatie;
- tokenopslag en CSP;
- audit en bewaartermijnen.

Client secrets horen nooit in de browser. Een flow die application permissions
of geheime credentials vereist, heeft een vertrouwde backend/BFF nodig en valt
buiten het huidige GitHub Pages-contract.

## Synchronisatiekeuzes

Voor een remote fase moet expliciet gekozen worden tussen:

1. online-only repository;
2. read-through cache;
3. offline-first synchronisatie met conflictresolutie.

IndexedDB mag niet stilzwijgend tot gedeelde source of truth worden gepromoveerd.
Bij offline-first zijn recordversies, tombstones, conflictregels en batchgrenzen
vereist.

## Gefaseerd migratieplan

1. Stabiliseer JSON-schema en repositorycontracten.
2. Leg representatieve volumes en permissies vast.
3. Maak een proof-of-concept adapter voor één read-only collectie.
4. Voeg contracttests toe die zowel JSON als remote adapter doorlopen.
5. Migreer writes per bounded context, met optimistic concurrency.
6. Bouw expliciete JSON → remote import met dry-run en validatierapport.
7. Vergelijk recordcounts, GUIDs, relaties, cents en historie semantisch.
8. Voer pilot, rollback en audit uit.
9. Beslis daarna of JSON lokale import/export, backup of alleen migratieformaat
   blijft.

## Niet doen

- O365-aanroepen rechtstreeks vanuit React-componenten;
- GUIDs vervangen door lijstindices;
- financiële cents via floating point migreren;
- historie samenvouwen tot alleen de laatste waarde;
- browsersecrets toevoegen om GitHub Pages te behouden;
- tegelijk opslag, domeinmodel en UI herschrijven.

## Migratieacceptatie

Een remote adapter is pas gelijkwaardig wanneer contracttests aantonen dat een
JSON-fixture na import dezelfde projecten, relaties, histories, budgetbedragen,
verslagversies en zoek-/aggregatieresultaten oplevert en wanneer autorisatie en
rollback operationeel zijn getest.
