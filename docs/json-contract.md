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
  "schemaVersion": "1.0.0",
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
| `budgets` | BudgetRecord | project, optioneel topic/leverancier |
| `budgetMutations` | BudgetMutation | budgetrecord, auteur |
| `meetings` | Meeting | scope, voorzitter, verslaggever |
| `meetingParticipants` | MeetingParticipant | overleg, actor |
| `agendaItems` | AgendaItem | overleg, optioneel bronobject |
| `reports` | Report | overleg, auteur |
| `reportItems` | ReportItem | verslag, optioneel snapshotbron |
| `config` | Config | optioneel huidige actor |
| `choiceLists` | ChoiceList | — |
| `log` | LogEntry | optioneel bronobject |

## Validatie bij openen

De grens valideert in vaste volgorde:

1. bestandsextensie;
2. JSON-syntax;
3. formaatsignatuur en ondersteunde schemaversie;
4. strikte envelope en veldtypes;
5. unieke GUIDs over alle collecties;
6. referentiële integriteit;
7. domeininvarianten, waaronder cluster/hoofdstuk, topicouder, current update,
   actie-eigenaar, planningcycli, budget-topicproject en overlegscope;
8. exact één Config-record en unieke keuzelijstsleutels.

Syntax-, structuur- en relatieproblemen zijn `Blocking`; het bestand wordt pas
actief na bevestiging en alleen als er geen blocking issues zijn. Ongeldige
financiële of relationele waarden worden nooit stilzwijgend aangepast.

## Opslaan en roundtrip

Voor download wordt de actuele domain state opnieuw relationeel gecontroleerd en
door hetzelfde Zod-schema gehaald. Afgeleide indices, filters en tijdelijke
formulierstate worden niet geschreven.

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
optionele relaties, cluster-/actie-/budgethistoriek en verslagsnapshots.

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

De huidige ondersteunde schemawaarde is `1.0.0`. Een onbekende versie wordt
geblokkeerd; er is geen opportunistische repair. Een toekomstige wijziging moet:

1. de schemaversie verhogen;
2. een expliciete, geteste migratiefunctie toevoegen;
3. de originele input ongewijzigd laten;
4. roundtripfixtures voor oud en nieuw schema opnemen;
5. dit contract en een ADR bijwerken.

Een IndexedDB v1-snapshot uit de voormalige Excelperiode kan alleen als lokale
domain records worden hersteld en moet vervolgens als JSON worden opgeslagen.
Operationele Excel-import en -export maken geen deel meer uit van dit contract.
