# JSON-datacontract — OLV Projectopvolging

## Status

Dit is het canonical operationele bestandscontract vanaf applicatieversie 1.1.0.
Beslissing: [ADR-011](decisions/ADR-011-json-portable-data-files.md).

## Bestand

- extensie: `.json`;
- encoding: UTF-8;
- MIME-type bij download: `application/json;charset=utf-8`;
- leesbaar formaat: twee spaties inspringing en afsluitende newline;
- bestandsnaam: `OLV_Projectopvolging_YYYY-MM-DD_HH-mm.json`.

Operationele bestanden worden niet in Git of de Pages-build opgenomen.

## Envelope

```json
{
  "format": "olv-projectopvolging",
  "schemaVersion": "1.1.0",
  "exportedAt": "2026-08-16T12:00:00.000Z",
  "appVersion": "1.1.0",
  "dataSetId": "00000000-0000-4000-8000-000000000001",
  "records": {
    "chapters": [],
    "clusters": [],
    "projects": [],
    "projectClusterHistory": [],
    "actors": [],
    "topics": [],
    "updates": [],
    "actions": [],
    "actionHistory": [],
    "evidence": [],
    "planning": [],
    "planningDependencies": [],
    "projectPhases": [],
    "milestones": [],
    "resources": [],
    "resourceAssignments": [],
    "budgets": [],
    "budgetMutations": [],
    "meetings": [],
    "meetingParticipants": [],
    "agendaItems": [],
    "reports": [],
    "reportItems": [],
    "config": [],
    "choiceLists": [],
    "log": []
  }
}
```

De envelope en elk record zijn strict: onbekende properties zijn een
schemafout. Iedere collectie is verplicht, ook wanneer ze leeg is. `config`
bevat exact één record en diens `dataSetId` en `schemaVersion` moeten overeenkomen
met de envelope.

## Basistypes

- `UUID`: geldige UUID; nieuwe records krijgen v4;
- `LocalDate`: `YYYY-MM-DD`, zonder tijdzoneconversie;
- `DateTime`: ISO-8601 UTC-datetime;
- geld: safe integer cents, nooit floating point;
- percentages: getal van 0 tot en met 100;
- optioneel veld: property mag ontbreken; `null` is niet de conventie;
- audit: `createdAt`, `updatedAt`, `active` en optionele actor-GUIDs.

Menselijke tekst blijft ongewijzigd UTF-8, inclusief accenten. Bedragen worden
bijvoorbeeld als `123456` bewaard voor € 1.234,56.

## Collecties

De velden en enums volgen [domain-model.md](domain-model.md). De JSON-namen zijn
dezelfde camelCase-namen als de domeinrecords; er is geen afzonderlijke
kolommapping.

| JSON-collectie | Domeinrecord | Primaire relaties |
|---|---|---|
| `chapters` | Chapter | — |
| `clusters` | Cluster | `chapterId` |
| `projects` | Project | `chapterId`, optioneel `clusterId`, coordinator |
| `projectClusterHistory` | ProjectClusterHistory | project, cluster, auteur |
| `actors` | Actor | — |
| `topics` | Topic | exact één project of cluster |
| `updates` | Update | bronobject, auteur, optioneel overleg |
| `actions` | Action | bronobject, eigenaar, optioneel overleg |
| `actionHistory` | ActionHistory | actie, actor |
| `evidence` | Evidence | bronobject, optioneel actor |
| `planning` | PlanningEntry | project, optioneel topic |
| `planningDependencies` | PlanningDependency | twee planningentries |
| `projectPhases` | ProjectPhase | project, optioneel eigenaar/voorganger |
| `milestones` | Milestone | project, optioneel fase/eigenaar |
| `resources` | Resource | optioneel actor |
| `resourceAssignments` | ResourceAssignment | project, optioneel fase, resource of rol |
| `budgets` | BudgetRecord | project, optioneel topic/leverancier |
| `budgetMutations` | BudgetMutation | budgetrecord, auteur |
| `meetings` | Meeting | scope, optioneel bronoverleg, voorzitter, verslaggever |
| `meetingParticipants` | MeetingParticipant | overleg, actor |
| `agendaItems` | AgendaItem | overleg, bronobject historisch optioneel |
| `reports` | Report | overleg, auteur |
| `reportItems` | ReportItem | verslag, optioneel snapshotbron |
| `config` | Config | optioneel huidige actor |
| `choiceLists` | ChoiceList | — |
| `log` | LogEntry | optioneel bronobject |

Voor `projectClusterHistory` moeten project en cluster altijd blijven bestaan.
Een afgesloten koppeling mag naar een cluster in een voormalig hoofdstuk van
het project verwijzen. Alleen een open koppeling moet overeenkomen met de
huidige `clusterId` en het huidige hoofdstuk van het project. Daardoor blijft
historiek geldig wanneer een project tussen hoofdstukken migreert.
Scopevalidatie van actieve agendakoppelingen geldt voor conceptoverleggen.
Definitieve overlegagenda's blijven historische context en worden bij een latere
projectverplaatsing niet opnieuw tegen de actuele indeling afgekeurd.

## Validatie bij openen

De grens valideert in vaste volgorde:

1. bestandsextensie;
2. JSON-syntax;
3. formaatsignatuur en ondersteunde schemaversie;
4. strikte envelope en veldtypes;
5. unieke GUIDs over alle collecties;
6. referentiële integriteit;
7. domeininvarianten, waaronder cluster/hoofdstuk, topicouder, current update,
   actie-eigenaar, planningcycli, budget-topicproject, overlegscope en geldige
   vervolgrelaties tussen overleggen;
8. exact één Config-record en unieke keuzelijstsleutels.

Syntax-, structuur- en relatieproblemen zijn `Blocking`; het bestand wordt pas
actief na bevestiging en alleen als er geen blocking issues zijn. Ongeldige
financiële of relationele waarden worden nooit stilzwijgend aangepast.

## Opslaan en roundtrip

Voor download wordt de actuele domain state opnieuw relationeel gecontroleerd en
door hetzelfde Zod-schema gehaald. Afgeleide indices, filters en tijdelijke
formulierstate worden niet geschreven.

Lokale werkruimtevoorkeuren — benoemde filterweergaven, recente/favoriete links,
tabeldichtheid en kolomzichtbaarheid — zijn evenmin onderdeel van de envelope.
Ze zijn apparaatgebonden UI-configuratie en mogen een semantische
JSON-roundtrip nooit beïnvloeden.

Verplicht regressiecontract:

```text
JSON openen
→ domain state
→ wijziging
→ JSON opslaan
→ JSON opnieuw openen
→ semantisch vergelijken
```

Dit contract omvat GUIDs, integer cents, booleans, lokale datums, Unicode,
optionele relaties, cluster-/actie-/budgethistoriek, vervolgoverleggen en
verslagsnapshots.

`Meeting.sourceMeetingId` is een optionele, achterwaarts compatibele relatie.
De adapter schrijft alleen de relatie; het opnieuw klaarzetten van open
agendapunten is applicatielogica en gebeurt uitsluitend bij het expliciet maken
van een vervolgoverleg.

## Nieuwe gegevensset

Een nieuwe set krijgt:

- een nieuwe stabiele `dataSetId`;
- exact één Config-record;
- de drie standaardhoofdstukken;
- basissuggesties voor projectfase, budgetcategorie en overlegtype;
- lege overige collecties.

Hoofdstukken, clusters, actoren en keuzelijsten kunnen daarna via Instellingen of
de ondersteunde inline contextacties worden beheerd.

## Schemaversies en migratie

### Projectjournaal

De uniforme projectjournalentry introduceert geen nieuwe JSON-collectie en
vereist geen schema-upgrade. Updates, acties, beslissingen, planning en
agenda-items behouden hun bestaande recordvorm. Optionele `Evidence`-records met
`type` `DecisionRequest` of `JournalRelation` dragen aanvullende journalmetadata
als JSON in `description`. Ongeldige metadata wordt bij de projectie genegeerd
en verandert de bronrecords niet.

Ook `MeetingLink` en `JournalHistory` gebruiken deze bestaande
`Evidence`-collectie. Een entryspecifieke `MeetingLink` verwijst in metadata naar
`meetingId`, `agendaItemId` en `meetingDate`; het bestaande topicgebonden
`AgendaItem` blijft het agendapunt. Overlegverwerking maakt dus geen aparte
notitie of verslaginvoer. Er ontstaat geen `entries`- of
`meetingLinks`-collectie en dus geen tweede source of truth. Zie
[ADR-014](decisions/ADR-014-continuous-project-journal.md).

`JournalCompletion` gebruikt eveneens de bestaande `evidence`-collectie en
verwijst naar een `Update`. Daardoor kan een update worden afgesloten en
heropend zonder extra collectie, schemawijziging of verlies van de brontekst.

De huidige schemawaarde is `1.1.0`. Schema `1.0.0` wordt expliciet gemigreerd:
de vier nieuwe planningcollecties worden leeg toegevoegd en de envelope en
Config krijgen versie `1.1.0`. Bestaande `PlanningEntry`-records en
`PlanningDependency`-records blijven ongewijzigd in hun oorspronkelijke
collecties, zodat oudere mijlpalen en vrije planningitems bewerkbaar en
verliesloos blijven. Andere onbekende versies worden geblokkeerd.

Een toekomstige wijziging moet:

1. de schemaversie verhogen;
2. een expliciete, geteste migratiefunctie toevoegen;
3. de originele input ongewijzigd laten;
4. roundtripfixtures voor oud en nieuw schema opnemen;
5. dit contract en een ADR bijwerken.

Een IndexedDB v1-snapshot uit de voormalige Excelperiode kan alleen als lokale
domain records worden hersteld en moet vervolgens als JSON worden opgeslagen.
Operationele Excel-import en -export maken geen deel meer uit van dit contract.

## Optionele projectomvang

`Project.size` bevat optioneel `XS`, `S`, `M`, `L`, `XL` of `XXL`. Ontbreken
betekent dat het project nog niet is ingeschaald. Het veld is achterwaarts
compatibel binnen schema 1.0.0 en 1.1.0; oude bestanden worden bij openen
expliciet gemigreerd.
