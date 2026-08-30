# Domeinmodel — OLV Projectopvolging

## Structuur

```text
Hoofdstuk
└─ Cluster
   ├─ Clustertopic
   └─ Project
      ├─ Projecttopic
      ├─ Updates / beslissingen
      ├─ Acties
      ├─ Planning
      ├─ Budget
      └─ Overleg
```

Project mag zonder cluster bestaan.

Alle persistente records worden als arrays in het JSON-datacontract bewaard;
Maps en aggregaties zijn afgeleide runtime-indices.

## Hoofdstuk

- id;
- code;
- title;
- order;
- status;
- audit.

Initiële hoofdstukken:

- Gebouw en ruimte;
- Technieken en infrastructuur;
- Beleid en opvolging.

## Cluster

- id;
- chapterId;
- code;
- title;
- description;
- status;
- currentUpdateId?;
- order;
- audit.

## Project

- id;
- chapterId;
- clusterId?;
- code;
- title;
- description;
- status;
- phase;
- site?;
- location?;
- department?;
- coordinatorActorId?;
- startDate?;
- plannedEndDate?;
- actualEndDate?;
- progressPercent?;
- size?: `XS | S | M | L | XL | XXL`;
- currentUpdateId?;
- documentsUrl?;
- audit.

Status:

- Idee;
- Voorbereiding;
- Studie;
- Aanbesteding;
- Uitvoering;
- Oplevering;
- On hold;
- Afgesloten;
- Geannuleerd.

## ProjectClusterHistory

- id;
- projectId;
- clusterId;
- validFrom;
- validTo?;
- reason?;
- authorActorId?;
- audit.

Maximaal één open koppeling per project.

Mutatieregels in fase 3:

- een nieuw project met cluster krijgt één open historiekrecord;
- een project zonder cluster krijgt geen vervangend of fictief clusterrecord;
- bij clusterwijziging worden bestaande open koppelingen gesloten en wordt één
  nieuwe open koppeling gemaakt;
- bij verwijderen van de cluster wordt de open koppeling gesloten zonder een
  record voor "Zonder cluster" te maken;
- project-ID en bestaande historiekrecords blijven behouden bij bewerken.

## Actor

- id;
- type;
- displayName;
- email?;
- organization?;
- role?;
- active;
- audit.

## Config

- id;
- schemaVersion;
- dataSetId;
- createdAt;
- appVersion;
- defaultCurrency;
- currentActorId?;
- audit.

Er bestaat exact één Config-record per gegevensset. `dataSetId` is stabiel over
opslaan en opnieuw openen en is onafhankelijk van de gedownloade bestandsnaam.

## ChoiceList

- id;
- listKey;
- valueKey;
- label;
- order;
- system;
- active;
- audit.

De combinatie `listKey + valueKey` is uniek. Keuzelijsten leveren suggesties;
bestaande vrije tekst blijft geldig waar het domein dat toestaat.

## Topic

- id;
- parentType: `Project | Cluster`;
- projectId?;
- clusterId?;
- code;
- title;
- context;
- ownerActorId?;
- priority;
- status;
- order;
- currentUpdateId?;
- audit.

Topic bevat geen dubbele planningdatums; timing zit in `PlanningEntry`.

Mutatieregels in fase 4:

- een nieuw topic krijgt een stabiele UUID v4 en exact één bestaande project-
  of clusterouder;
- een ingevulde eigenaar verwijst naar een actieve actor;
- statusovergangen behouden hetzelfde topicrecord en ondersteunen `Open`,
  `Afgesloten`, `Geannuleerd` en heropenen naar `Open`;
- een journaalbijdrage is append-only: bestaande updates en beslissingen worden
  niet overschreven of verwijderd;
- `currentUpdateId` is leeg of verwijst naar precies één actieve update waarvan
  `objectType = Topic` en `objectId` gelijk is aan het topic-ID;
- een gewone update kan bij opslaan als actuele stand worden gemarkeerd; een
  beslissing blijft standaard een afzonderlijke journaalbijdrage.

## Update

### Uniforme journalentry

Binnen de project-UX is `JournalEntry` een application-level discriminated
union met de types `update`, `action` en `decision`. De persistente bron blijft:

- `update` → `Update` met type `Update`;
- `decision` → `Update` met type `Beslissing`;
- `action` → `Action`.

Een typewissel archiveert de vorige representatie, activeert de nieuwe
representatie en registreert de overgang in `ActionHistory`. Een afgeleide actie
of een nieuw opvolgtopic bewaart de bronrelatie als getypeerd `Evidence`-record.
Een beslissingsvraag is eveneens getypeerde evidence met status `pending`,
`decided` of `cancelled`; de beslissing zelf blijft een gewone journalentry.

- id;
- objectType;
- objectId;
- meetingId?;
- type;
- date;
- authorActorId;
- text;
- audit.

Types:

- Update;
- Beslissing;
- Projectstatus;
- Clusterstatus;
- Notitie;
- Overlegbijdrage;
- Planningwijziging;
- Budgetwijziging.

De snelle fase-4-invoer ondersteunt op topicniveau `Update`, `Notitie`,
`Overlegbijdrage` en `Beslissing`. De overige types blijven importeerbaar en
zichtbaar in het gecombineerde projectjournaal.

Bij nieuwe invoer verwijst `authorActorId` naar een actieve actor. De gebruiker
kan de auteur expliciet kiezen of inline een actor toevoegen. Wanneer een actieve
huidige actor is ingesteld, blijft die de auditactor (`createdByActorId` en
`updatedByActorId`); de gekozen auteur kan daarvan verschillen. Zonder huidige
actor wordt de gekozen auteur ook als auditactor gebruikt. Historische updates
met een later gedeactiveerde auteur blijven geldig en zichtbaar.

## Action

- id;
- objectType;
- objectId;
- sourceMeetingId?;
- code;
- title;
- description?;
- ownerActorId;
- deadline?;
- status;
- priority;
- completedAt?;
- audit.

Regels:

- `objectType` en `objectId` verwijzen samen naar een bestaand Project, Cluster,
  Topic of Meeting;
- eigenaar verwijst naar een actieve actor;
- deadline is optioneel;
- status `Afgerond` vereist `completedAt`;
- iedere andere status heeft geen `completedAt`;
- heropenen wist de afronddatum;
- `Geannuleerd` behoudt het record en is geen delete;
- achterstallig wordt afgeleid als `deadline < vandaag` bij een status anders
  dan `Afgerond` of `Geannuleerd`.

Statussen:

- Open;
- Bezig;
- Wacht op derde;
- Wacht op beslissing;
- Afgerond;
- Geannuleerd.

## ActionHistory

- id;
- actionId;
- changedAt;
- changedByActorId;
- field;
- previousValue?;
- newValue?;
- reason?;
- audit.

Wijzigingen aan eigenaar, deadline, status en prioriteit maken elk een apart,
append-only historierecord. Afronden en heropenen overschrijven bestaande
historiek niet.

## Evidence

- id;
- objectType;
- objectId;
- type;
- title;
- description?;
- urlOrReference?;
- date?;
- authorActorId?;
- audit.

## PlanningEntry

- id;
- projectId;
- topicId?;
- kind: `Topic | Milestone | Custom`;
- title;
- startDate?;
- plannedEndDate;
- actualEndDate?;
- progressPercent?;
- status;
- isMilestone;
- order;
- audit.

Regels:

- ieder item hoort bij één project;
- topicId is optioneel;
- topic hoort bij hetzelfde project;
- per topic maximaal één primaire entry;
- milestone heeft één datum;
- topic zonder entry verschijnt niet in Gantt.

## PlanningDependency

- id;
- predecessorPlanningId;
- successorPlanningId;
- type: `FinishToStart`;
- audit.

Geen self-link en geen cyclus.

Fase-6-mutatieregels:

- een `PlanningEntry` met `topicId` heeft `kind = Topic`, hoort bij hetzelfde
  project en is de enige actieve primaire entry voor dat topic;
- een topicmoment mag als mijlpaal worden weergegeven zonder het topicrecord
  met datumvelden uit te breiden;
- een mijlpaal heeft geen `startDate` en alleen 0 of 100 procent voortgang;
- een periode vereist `startDate`, `plannedEndDate >= startDate` en voortgang
  tussen 0 en 100;
- vertraging is afgeleid uit `vandaag > plannedEndDate` voor niet-afgeronde en
  niet-geannuleerde items en wijzigt de opgeslagen status nooit;
- een dependency is alleen `FinishToStart`, blijft binnen één project en mag
  geen duplicaat, self-link of cyclus vormen;
- projectvoortgang blijft het handmatig beheerde veld op `Project` en wordt
  nooit uit topicvoortgang gemiddeld.

De globale planningssamenvatting is afgeleid uit het gefilterde portfoliomodel:

- planningdekking telt een project met een projectdatum of minstens één zichtbaar
  actief planningitem;
- planningitems en mijlpalen worden als records geteld, zonder projectrecords
  dubbel mee te tellen;
- aandacht telt elk item maximaal één keer bij status `Risico`, `Vertraagd` of
  een afgeleide overschreden einddatum;
- de zichtbare periode is de vroegste tot laatste project- of planningdatum.

## BudgetRecord

- id;
- projectId;
- topicId?;
- category;
- type;
- description;
- amountCents;
- date;
- status;
- reference?;
- supplierActorId?;
- audit.

Types:

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

## BudgetMutation

- id;
- budgetRecordId;
- changeType;
- deltaCents?;
- previousAmountCents?;
- newAmountCents?;
- reason;
- date;
- authorActorId;
- audit.

Fase-7-mutatieregels:

- ieder budgetrecord heeft exact één bestaand `projectId`;
- een optioneel topic is een projectdimensie en hoort bij hetzelfde project;
- bedragen zijn niet-negatieve, gehele cents;
- meer- en minwerk worden positief opgeslagen; alleen de typebetekenis bepaalt
  respectievelijk `+` en `-` in de netto meer/minwerkanalyse;
- een ingevulde leverancier verwijst bij nieuwe invoer naar een actieve actor;
- een nieuw record, inclusief type `Correctie`, is een nieuw financieel feit;
- een foutcorrectie op een bestaand bedrag vereist een actieve huidige actor,
  reden en afwijkend nieuw bedrag en maakt één append-only `BudgetMutation`;
- de mutatiedelta is exact `newAmountCents - previousAmountCents`;
- ontbrekende businessregels voor kernaggregaties worden expliciet als
  onbeschikbaar gemodelleerd en niet geïmproviseerd.

## Meeting

- id;
- sourceMeetingId?;
- type;
- scopeType;
- scopeId?;
- number?;
- title;
- date;
- chairActorId?;
- reporterActorId?;
- status;
- nextMeetingDate?;
- audit.

Scope:

- Portfolio;
- Hoofdstuk;
- Cluster;
- Project.

Invarianten:

- `Portfolio` heeft geen `scopeId`;
- `Hoofdstuk`, `Cluster` en `Project` hebben exact één bestaand `scopeId` van
  het overeenkomstige type;
- voorzitter, verslaggever en deelnemers verwijzen naar actieve actoren;
- status is `Concept` of `Definitief`;
- `sourceMeetingId` verwijst, indien gevuld, naar een ander actief overleg met
  exact dezelfde scope;
- een vervolgoverleg krijgt een nieuw ID en kopieert alleen actieve,
  brongebonden agendapunten met status `Te bespreken` of `Doorgeschoven`; de
  nieuwe punten krijgen nieuwe IDs en status `Te bespreken`;
- deelnemers en basisvelden worden in het vervolgformulier vooringevuld, maar
  pas bij expliciete save opgeslagen;
- een definitief overleg blijft historisch beschikbaar en inhoudelijke
  mutaties vereisen een nieuwe verslagrevisie.

## MeetingParticipant

- id;
- meetingId;
- actorId;
- role?;
- attended?;
- audit.

De combinatie `meetingId` + `actorId` is uniek. Aanwezigheid wordt tijdens de
verwerking geregistreerd; personen worden niet als vrije tekst gedupliceerd.

## AgendaItem

- id;
- meetingId;
- order;
- objectType?;
- objectId?;
- title;
- reason?;
- notes?;
- discussionStatus;
- audit.

Nieuwe of bewerkte agendapunten verwijzen naar één bestaand `Project` of `Topic`
binnen de overlegscope. Historisch geïmporteerde vrije of anders gekoppelde
punten blijven leesbaar omdat de bronvelden optioneel zijn, maar kunnen niet als
nieuw los punt worden opgeslagen. De volgorde is expliciet en uniek gemaakt
door de applicatieservice. Bespreekstatus is `Te bespreken`, `Besproken` of
`Doorgeschoven`.

Een actief bronrecord kan per overleg maximaal één actief gekoppeld agendapunt
hebben. Vanuit een project- of topicdossier worden alleen toekomstige actieve
conceptoverleggen met een passende scope als nieuwe keuze aangeboden. Eerdere of
definitieve koppelingen blijven zichtbaar als historiek, maar zijn niet opnieuw
selecteerbaar. De contextuele invoer bewaart een optionele bespreekreden op het
agendapunt en muteert pas bij `Op agenda plaatsen`.

## Report

Nieuwe of bewerkte `AgendaItem`-records verwijzen in de applicatieservice naar
precies één bestaand `Project` of `Topic` binnen de overlegscope. Historisch
geïmporteerde vrije of anders gekoppelde punten blijven leesbaar omdat de
bronvelden in het JSON-schema optioneel blijven, maar moeten vóór inhoudelijke
bewerking opnieuw worden gekoppeld. Een aanleiding blijft tekst op het
brongebonden agendapunt en wordt geen los domeinrecord.

De universele invoerkaart schrijft afhankelijk van de gekozen knop exact één
`Update`, één `Update` met type `Beslissing`, of één `Action`. Updates en
beslissingen blijven append-only; een lege kaart schrijft niets.

- id;
- meetingId;
- version;
- status;
- draftDate?;
- finalDate?;
- authorActorId;
- pdfReference?;
- audit.

## ReportItem

Snapshotrecord:

- id;
- reportId;
- order;
- section;
- contentType;
- objectType?;
- objectId?;
- titleSnapshot;
- textSnapshot;
- audit.

Snapshottekst wordt later niet automatisch gewijzigd.

Verslagstatus is `Concept`, `Definitief` of `Gereviseerd`. Versienummers zijn
positieve, oplopende integers en uniek binnen één overleg. Een definitief
verslag en zijn `ReportItem`-records worden nooit overschreven. Een correctie
maakt versie `n + 1` met status `Gereviseerd` en een zichtbare correctienotitie;
de eerdere snapshot blijft ongewijzigd.

Updates en beslissingen uit een overleg blijven één `Update`-record met zowel
de broncontext (`objectType`/`objectId`) als `meetingId`. Acties blijven één
`Action`-record met `sourceMeetingId`. Daardoor verschijnen bijdragen in het
overleg én in hun brondossier zonder kopie of dubbeltelling.
