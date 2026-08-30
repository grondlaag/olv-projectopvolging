# ADR-014 — Doorlopend projectjournaal als applicatieprojectie

## Status

Aanvaard op 2026-08-30.

## Context

De bestaande genormaliseerde toestand bewaart updates, beslissingen, acties,
planning en agendapunten in afzonderlijke domeincollecties. De goedgekeurde
Journaal-ervaring vereist daarentegen één chronologische stroom per topic, met
beslissingsvragen, inline typewissels en meervoudige overlegkoppelingen.

Een nieuwe persistente `entries`-collectie zou dezelfde operationele feiten
dupliceren en Dashboard, Planning en Overleg van een tweede source of truth
afhankelijk maken.

## Beslissing

- `ProjectJournalWorkspace` projecteert `Update`, `Action` en getypeerde
  `Evidence` naar één `JournalEntryView` met de types `update`, `action`,
  `decision_request` en `decision`.
- Topics worden in het Journaal uitsluitend op `Topic.audit.createdAt`
  gesorteerd, nieuwste eerst. Nieuwe activiteit verandert hun positie niet.
- Nieuwe projecttopics krijgen een stabiele code `T-###`. Bij het bepalen van
  het volgende nummer tellen ook inactieve records mee; nummers worden dus niet
  hergebruikt. Bestaande `TOP-###`-codes blijven verliesloos opgeslagen en
  worden in het Journaal als `T-###` gepresenteerd.
- Beslissingsvragen, journalhistoriek, afleidingsrelaties en entryspecifieke
  overlegkoppelingen worden als getypeerde `Evidence` bewaard. De bestaande
  `AgendaItem` blijft de agenda-integratie en verwijst naar het brontopic.
- Een typewissel tussen verschillende persistente collecties krijgt een nieuwe
  UUID v4, archiveert de oude representatie en kopieert het oorspronkelijke
  `createdAt`. Zo blijven globale GUID-uniciteit, audit en chronologische
  positie tegelijk correct.
- Markdown wordt zonder HTML-injectie naar React-elementen gerenderd. De
  persistente brontekst blijft ongewijzigd.

## Gevolgen

Dashboard en Planning blijven rechtstreeks dezelfde acties, updates en
beslissingen lezen. Er komt geen schema-upgrade of nieuwe JSON-collectie. De
Evidence-metadata is optioneel en wordt bij ongeldige JSON genegeerd; het
bronrecord blijft leesbaar. Plan-pinfunctionaliteit blijft buiten scope.

## Regressiecontract

Gerichte tests bewijzen topicsortering, oplopende topiccodes, de vier entrytypes,
Markdownblokken, auditveilige typewissels en meerdere overlegkoppelingen. De
volledige JSON-roundtrip blijft onderdeel van de releasechecks.
