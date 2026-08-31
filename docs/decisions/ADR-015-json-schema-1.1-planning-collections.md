# ADR-015 — JSON-schema 1.1 voor aanvullende planningcollecties

## Status

Aanvaard.

## Context

De nieuwste domeinstate bevat naast `PlanningEntry` en
`PlanningDependency` vier aanvullende collecties voor projectfasen,
mijlpalen, resources en resource-inzet. Het schema 1.0 bevatte die collecties
niet. Een eerste migratievoorstel zette bestaande vrije planningitems en
mijlpalen automatisch om, maar de huidige UI bewerkt die nieuwe recordtypes nog
niet overal. Automatische omzetting zou bestaande functionaliteit en
roundtripsemantiek breken.

## Beslissing

- JSON-schema 1.1 bevat 26 verplichte collecties.
- Import van schema 1.0 voegt `projectPhases`, `milestones`, `resources` en
  `resourceAssignments` als lege arrays toe.
- Bestaande `planning`- en `planningDependencies`-records blijven byte-semantisch
  in hun oorspronkelijke collecties.
- De migratie werkt op een clone en verhoogt zowel envelope als Config naar
  schema 1.1.
- Export schrijft envelope en Config altijd met de actuele schemaversie, ook na
  lokaal herstel van een oudere sessie.
- De legacy-Exceladapter blijft beperkt tot zijn 22 schema-1.0-collecties en is
  geen operationeel migratiepad voor de vier nieuwe collecties.

## Gevolgen

Oude JSON-bestanden blijven verliesloos bruikbaar. Nieuwe bestanden hebben een
expliciet uitbreidbaar contract zonder twee interpretaties van hetzelfde oude
planningrecord. Een toekomstige UI-migratie naar de nieuwe recordtypes vereist
een afzonderlijke, expliciete gebruikersactie en regressietest.
