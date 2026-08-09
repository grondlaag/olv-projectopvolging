# ADR-006 — Projectbudget met optionele topicdimensie

Status: Accepted

## Context

Topics kunnen budgetimpact hebben, maar projecttotalen mogen niet dubbel tellen.

## Beslissing

Elk `BudgetRecord` hoort verplicht bij één project.

`topicId` is optioneel.

Een budgetrecord met `topicId` wordt in topicdetail getoond maar blijft hetzelfde record in projectaggregatie.

Bedragen worden als integer cents verwerkt.

## Gevolgen

- geen structurele topic/project dubbeltelling;
- project is financiële hoofdcontext;
- topic blijft analysegroep.

## Fase-7-addendum: aggregatieguardrail

De recordstructuur is voldoende beslist om budgetfeiten, topickoppelingen,
meer/minwerk en correctiehistoriek te beheren. De statusselectie, semantiek van
meerdere ramingen en samenhang tussen contract, bestelling, factuur, betaling
en contingentie zijn niet beslist.

Fase 7 implementeert daarom geen impliciete `laatste rij wint`-logica en geen
zelfgekozen prognoseformule. Afgeleide financiële kerncijfers blijven expliciet
`business-rule-required` tot een opvolgbeslissing de aggregatieregels vastlegt.
Directe type-/statusuitsplitsingen en `Meerwerk - Minwerk` zijn wel beschikbaar.
