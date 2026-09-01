# ADR-016 — Strategische planning op schema 1.1

## Status

Aanvaard.

## Context

De portfolio-Gantt moet naast bestaande topicplanning ook projectfasen,
mijlpalen en eenvoudige assetcapaciteit bruikbaar maken. Schema 1.1 bevat de
collecties `projectPhases`, `milestones`, `resources` en
`resourceAssignments` al. Bestaande bestanden bevatten daarnaast
`PlanningEntry`-records die operationeel en historisch betekenisvol zijn.

Een automatische omzetting zou niet betrouwbaar kunnen bepalen of een vrij
planningitem een fase, mijlpaal of alleen een bestaande afspraak is. Zo'n
interpretatie zou de semantiek en audittrail stilzwijgend wijzigen.

## Besluit

- De bestaande schema-1.1-collecties zijn de bron voor strategische fasering,
  eersteklas mijlpalen en assets.
- Topicdatums blijven uitsluitend in maximaal één primaire `PlanningEntry`;
  een timingitem maakt daarom atomair een topic en diens planningentry aan via
  application services.
- Bestaande `PlanningEntry`-records blijven zichtbaar en bewerkbaar en worden
  niet automatisch gemigreerd.
- Planningssjablonen worden alleen op uitdrukkelijk verzoek toegepast wanneer
  een project nog geen actieve fases heeft.
- XS–XXL is een indicatief profiel. Werkelijke capaciteitsbelasting wordt uit
  afzonderlijke toewijzingen per periode berekend.
- Planningselecties muteren de route niet. Projecten, fases, mijlpalen,
  toewijzingen en capaciteit openen in een rechter eigenschappenpaneel.
- Capaciteit wordt in versie 1 per kalendermaand berekend. Boven 100% van de
  projectbeschikbare capaciteit ontstaat een conflict met project-/faseopbouw.

## Gevolgen

De wijziging vereist geen schema- of bestandsmigratie en blijft compatibel met
GitHub Pages en lokale JSON-opslag. De UI kan zowel oude als nieuwe
planningrecords naast elkaar tonen. Drag/drop, leveling, kritieke-padberekening
en automatische herschikking blijven buiten scope.
