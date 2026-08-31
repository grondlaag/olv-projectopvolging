# Planning en budget — businessregels

# A. Planning

## Doel

Planning ondersteunt:

- projecttijd;
- optionele topictiming;
- vrije mijlpalen;
- afhankelijkheden;
- risico/vertraging;
- Gantt.

## Project

Project bevat:

- startDate;
- plannedEndDate;
- actualEndDate?;
- progressPercent?.

Dit vormt de samenvattende projectbalk.

## Topic

Topic bevat zelf geen duplicatieve planningdatums.

Een getimed topic krijgt maximaal één primaire `PlanningEntry`.

## Vrije mijlpaal

PlanningEntry zonder topic.

Voorbeelden:

- uiterste indiendatum;
- gunning;
- einde standstill;
- bevel van aanvang;
- voorlopige oplevering.

## PlanningEntry

```ts
interface PlanningEntry {
  id: UUID
  projectId: UUID
  topicId?: UUID
  kind: "Topic" | "Milestone" | "Custom"
  title: string
  startDate?: LocalDate
  plannedEndDate: LocalDate
  actualEndDate?: LocalDate
  progressPercent?: number
  status: PlanningStatus
  isMilestone: boolean
  order: number
}
```

## Mijlpaal

- geen duur;
- plannedEndDate = mijlpaaldatum;
- startDate leeg;
- progress 0 of 100;
- Gantt toont ruit.

## Periode

- startDate verplicht;
- plannedEndDate verplicht;
- einde >= start;
- progress 0–100.

## Planningstatus

- Niet gestart;
- Op schema;
- Risico;
- Vertraagd;
- Afgerond;
- Geannuleerd.

Status is niet uitsluitend automatisch.

## Vertraging

Afgeleide waarschuwing:

```text
vandaag > plannedEndDate
AND status niet Afgerond/Geannuleerd
```

Dit hoeft status niet automatisch te wijzigen.

Voor het fase-2-dashboard betekent `komende mijlpalen`: niet-afgeronde en
niet-geannuleerde mijlpalen met een datum van vandaag tot en met 30 kalenderdagen
vooruit. Dit is een read-only signalering, geen statuswijziging.

## Afhankelijkheden

Versie 1:

```text
Finish-to-start
```

Regels:

- predecessor bestaat;
- successor bestaat;
- geen zelfreferentie;
- geen cyclus;
- beide binnen hetzelfde project in MVP.

## Optionele fasering en resources (schema 1.1)

Naast `PlanningEntry` kan een gegevensset projectfasen, afzonderlijke
mijlpalen, resources en resource-inzet bevatten. Deze records zijn aanvullend:
de schema-1.0-planning blijft de bewerkbare bron voor bestaande topicplanning,
vrije periodes en mijlpalen. Migratie verplaatst of herinterpreteert die records
niet automatisch.

Een fase heeft een periode, handmatige voortgang, intensiteit en optioneel één
voorganger binnen hetzelfde project. Resource-inzet verwijst naar hetzelfde
project en, indien ingevuld, naar een fase van dat project. Capaciteit en inzet
zijn niet-negatief; projectbeschikbaarheid overschrijdt de totale capaciteit
niet.

## Projectvoortgang

Standaard:

```text
handmatig projectpercentage
```

Geen impliciet gemiddelde.

Later mogelijk:

- gewogen topics;
- duurgewogen;
- budgetgewogen.

Alleen na expliciete businessregel.

## Gantt

Portfolio:

```text
Hoofdstuk
  Cluster
    Project
```

Project:

```text
Project summary
  Topic
  Topic
  Mijlpaal
  Topic
```

Zoom:

- week;
- maand;
- kwartaal;
- jaar.

MVP interactie:

- selecteren;
- openen;
- filteren;
- zijpaneel bewerken.

Drag/drop pas na undo + validatie + dependency checks.

## Implementatiestatus fase 6

De productie-interface ondersteunt nu:

- topicdetail: `+ Timing` en `Timing bewerken` voor projecttopics;
- projectplanning: topicperiodes, vrije periodes, projectmijlpalen en
  finish-to-start-afhankelijkheden;
- project-Gantt op `#/projects/<projectId>/planning`;
- portfolio-Gantt op `#/planning`, inclusief `Zonder cluster`, filters en
  standaard ingeklapte detailplanning;
- compacte portefeuillesamenvatting zonder projectselectie: geplande projecten,
  projecten zonder planning, planningitems, mijlpalen, aandachtspunten en
  zichtbare periode;
- week-, maand-, kwartaal- en jaarzoom met automatische viewport;
- afgeleide waarschuwingen voor overschreden planning zonder statusmutatie;
- dashboardlijsten voor komende mijlpalen, vertraagde items en projecten met
  planningsrisico.

De Gantt is read-only-first. Selecteren opent formulierbewerking in een
zijpaneel; drag/drop, auto-scheduling en automatisch berekende
projectvoortgang zijn niet geïmplementeerd. Zie ADR-009.
Project-, topic-, actie- en beslissingsregels openen daarbij op dezelfde route
een rechterpaneel. Topictiming toont start- en einddatum en schrijft via
`saveTopicTiming` naar de enige primaire `PlanningEntry`.

De portefeuillesamenvatting volgt de actieve filters. Een project telt als
ingepland wanneer het een projectstart/einddatum of minstens één zichtbaar actief
planningitem heeft. Een aandachtspunt is een uniek planningitem met status
`Risico` of `Vertraagd`, of met een overschreden einddatum terwijl het niet
afgerond/geannuleerd is.

# B. Budget

## Filosofie

Budget is recordgericht.

Geen tweede set handmatig onderhouden projecttotalen als source of truth.

Alle budgetrecords horen bij een project.

Een record kan optioneel een topicdimensie hebben.

## BudgetRecord

```ts
interface BudgetRecord {
  id: UUID
  projectId: UUID
  topicId?: UUID
  category: string
  type: BudgetType
  description: string
  amountCents: number
  date: LocalDate
  status: BudgetStatus
  reference?: string
  supplierActorId?: UUID
}
```

## Types

- Goedgekeurd budget;
- Raming;
- Contract;
- Bestelling;
- Factuur;
- Betaling;
- Meerwerk;
- Minwerk;
- Contingentie;
- Correctie.

## Status

- Concept;
- Verwacht;
- Goedgekeurd;
- Vastgelegd;
- Gefactureerd;
- Betaald;
- Geannuleerd.

## Aggregatie

Pure gecentraliseerde functies.

Definieer expliciet:

- goedgekeurd;
- actuele raming;
- vastgelegd;
- gefactureerd;
- betaald;
- prognose eindkost;
- resterend;
- afwijking.

Geen "laatste rij wint" zonder businessregel.

## Topicbudget

Budgetrecord met `topicId`:

- blijft hetzelfde projectrecord;
- verschijnt in topicdetail;
- wordt niet opnieuw opgeteld.

Dubbeltelling is structureel uitgesloten.

## Meer- en minwerken

Aanbevolen conventie:

- bedrag positief;
- type bepaalt teken in aggregatie.

Leg dit vast in tests.

## Correcties

Historie niet overschrijven.

Gebruik mutatie met:

- reden;
- auteur;
- datum;
- oude/nieuwe waarde of delta.

## Precisie

Domein:

```text
integer cents
```

UI:

```text
€ 123.456,78
```

JSON:

dezelfde integer cents als het domein, zonder conversie naar floating point.

## Projectbudgetdashboard

- goedgekeurd;
- actuele raming;
- vastgelegd;
- gefactureerd;
- betaald;
- prognose;
- resterend;
- afwijking €;
- afwijking %;
- contingentie.

## Portfoliobudget

- totaal goedgekeurd;
- prognose;
- afwijking;
- per hoofdstuk;
- per cluster;
- per fase;
- grootste afwijkingen;
- projecten zonder actuele raming.

## Implementatiestatus fase 7

Fase 7 levert de financiële ledger volledig op:

- projectgebonden `BudgetRecord` met optionele topicdimensie;
- bedragen als integer cents en Belgische euro-opmaak in de UI;
- invoer, filters, project- en portfolioanalyse;
- expliciete positieve opslag voor meer- en minwerk, waarbij het type het teken
  bepaalt voor de afzonderlijke netto meer/minwerkanalyse;
- append-only `BudgetMutation` voor een foutcorrectie van een bestaand bedrag;
- JSON-roundtrip via de collecties `budgets` en `budgetMutations`.

Een nieuw record van het type `Correctie` is een nieuw financieel feit. Een
correctie van een fout in een bestaand record wijzigt het recordbedrag en maakt
altijd een `BudgetMutation` met oude waarde, nieuwe waarde, delta, reden, auteur
en datum.

### Open businessbeslissing: financiële kernaggregaties

De brondocumentatie bepaalt nog niet exact:

1. welke recordstatussen per kerncijfer meetellen;
2. of meerdere ramingen cumulatieve deelramingen of opeenvolgende versies zijn;
3. hoe contract, bestelling, factuur en betaling elkaar in `vastgelegd` en
   `prognose eindkost` overlappen of vervangen;
4. hoe contingentie in de prognose wordt verwerkt;
5. welk teken en welke doelaggregatie een nieuw feit van het type `Correctie`
   krijgt.

Daarom worden `goedgekeurd budget`, `actuele raming`, `vastgelegd`,
`gefactureerd`, `betaald`, `contingentie`, `prognose eindkost`, `resterend` en
`afwijking` in fase 7 niet met een willekeurige formule berekend. De UI toont
voor deze velden `Regel vereist`. Pure domeinfuncties leveren wel controleerbare
recordaantallen, bedragen per exact type en status, en de afzonderlijke netto
meer/minwerkanalyse. Projecten zonder een niet-geannuleerd ramingrecord worden
als feitelijk signaal getoond; dit is nog niet gelijk aan een besliste
`actuele raming`.

Voor activering van de kern-KPI's is een vervolg op ADR-006 nodig dat de vijf
keuzes hierboven expliciet vastlegt, met rekenvoorbeelden en historische
semantiek.

## UX-addendum brongebonden planning en budget

Nieuwe planning ontstaat via projectdatums, topic-timing, actiedeadlines of
gedateerde beslissingen. De Gantt projecteert actie en beslissing rechtstreeks,
zonder tweede planningrecord. Nieuwe vrije items worden niet aangeboden;
historische vrije records blijven leesbaar en bewerkbaar.

Projectomvang `XS | S | M | L | XL | XXL` gebruikt de expliciete indicatieve
factoren `0,10 | 0,25 | 0,50 | 1,00 | 1,50 | 2,00 VTE`. Dit is portfoliovraag,
geen personeelsallocatie. De budgetmatrix volgt hoofdstuk, cluster en project.
Nieuwe invoer focust op zeven feittypes; legacytypes blijven roundtripbaar.
Onbesliste kern-KPI's blijven onbeschikbaar volgens ADR-006.
