# ADR-013 - Brongebonden planning, projectomvang en veilig archiveren

Status: Accepted

## Context

Vrije planningitems maakten een tweede, losstaande werkelijkheid naast topics,
acties en beslissingen. Daarnaast ontbraken projectomvang, resource-inzicht en
een veilige verwijderactie voor topics en budgetregels.

## Beslissing

- Nieuwe planning ontstaat via projectdatums, topic-timing, actiedeadlines of
  gedateerde beslissingen. Acties en beslissingen worden rechtstreeks in de
  Gantt geprojecteerd; er ontstaat geen dubbel `PlanningEntry`-record.
- Historische vrije `Milestone`- en `Custom`-records blijven leesbaar en
  bewerkbaar, maar de UI maakt er geen nieuwe meer aan.
- `Project.size` is optioneel en gebruikt `XS | S | M | L | XL | XXL`.
- De indicatieve factoren zijn respectievelijk 0,10, 0,25, 0,50, 1,00, 1,50 en
  2,00 VTE. Niet-ingeschaalde projecten tellen niet stil mee. Dit is
  portfoliovraag en geen toewijzing aan medewerkers.
- Topic verwijderen deactiveert het record en zet de status op `Geannuleerd`;
  gekoppelde historie blijft behouden.
- Budget verwijderen deactiveert het record, zet de status op `Geannuleerd` en
  maakt een append-only `BudgetMutation`.
- Nieuwe budgetinvoer focust op goedgekeurd budget, raming, contract, factuur,
  betaling, meerwerk en minwerk. Bestaande overige types blijven geldig en
  roundtrip-compatibel. Kern-KPI's blijven `business-rule-required` zolang
  ADR-006 geen aggregatieformules vastlegt.
- Conceptverslagen gebruiken de actieve verslaggever, voorzitter of deelnemer
  als auteur en vereisen geen verborgen huidige-actorinstelling.

## Visuele gevolgen

Portfoliohoofdstukken en clusters zijn afzonderlijk inklapbaar. De planning
combineert lagen en Gantt, met klikbare bronrecords en een compacte XS-XXL-band.
Agenda- en verslag-PDF gebruiken een rustige documentkop, metadataband,
sectiescheidingen en paginanummers. Topicdatums breken zonder overlap.

## Contract en compatibiliteit

`Project.size` is een optioneel veld in schema 1.0.0; oude bestanden blijven
geldig. Er verdwijnen geen enumwaarden of collecties. JSON-roundtrip bewaart
ook gearchiveerde records en hun audit/mutatiehistorie.

## Tests

Gerichte regressies dekken verslagopbouw zonder huidige actor, brongebonden
Gantt-lagen, VTE-samenvatting en audit-safe archiveren. De bestaande
JSON-, GitHub Pages-, budget-, topic- en overlegflows blijven verplicht.
