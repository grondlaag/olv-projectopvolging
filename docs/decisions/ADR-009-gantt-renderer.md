# ADR-009 — Lichte DOM/SVG-renderer voor Gantt

Status: Accepted

Datum: 2026-08-09

## Context

Fase 6 vereist een browser-only project- en portfolio-Gantt met week-, maand-,
kwartaal- en jaarzoom, mijlpalen, voortgang, expliciete statussen,
finish-to-start-lijnen en toegankelijke formulierbewerking. Drag/drop,
auto-scheduling, resourceplanning en kritieke-padberekening vallen buiten de
MVP. De productie blijft een statische React-app op GitHub Pages.

## Onderzoek

De volgende actuele opties zijn beoordeeld op licentie, Reactintegratie,
onderhoud, runtimegewicht, toegankelijkheid, afhankelijkheden, styling,
performance en Pages-geschiktheid:

| Optie | Beoordeling op 2026-08-09 |
| --- | --- |
| [Frappe Gantt](https://github.com/frappe/gantt) | MIT, actief en zonder runtime dependencies; ondersteunt views en dependencylijnen. De API is imperatief en niet React-native. De ingebouwde interactieve taakmutaties vragen een extra synchronisatielaag met onze genormaliseerde state. |
| [gantt-task-react](https://github.com/MaTeMaTuK/gantt-task-react) | MIT en React/TypeScript-native met taak-, project- en mijlpaaltypen. De publieke npm-versie was circa vier jaar niet gepubliceerd en de component brengt eigen selectie-, drag- en mutatiegedrag mee. |
| [SVAR React Gantt](https://www.npmjs.com/package/@svar-ui/react-gantt) | Actieve MIT-core met React 19, TypeScript, dependencies, zoom en virtualisatie; op het onderzochte moment 17 package-dependencies. Undo/redo, verticale markers en auto-scheduling zitten in PRO. Dat snijdt precies door de veiligheidsgrens van deze MVP. |
| [DHTMLX Gantt](https://docs.dhtmlx.com/gantt/) | Zeer volledig en performant, maar de Reactintegratie en brede editor-API zijn zwaarder dan de gevraagde read-only-first scope. Licentie- en wrapperkeuzes vergroten de onderhoudsoppervlakte. |
| [Bryntum Gantt](https://bryntum.com/products/gantt/) | Sterke React-, dependency- en performancefunctionaliteit, maar commercieel en veel omvangrijker dan de beperkte MVP. |

Een exacte minified/gzipvergelijking is niet als stabiel besliscriterium gebruikt:
die verandert per release en bundler. Wel is het dependency- en bundelprofiel
meegewogen. De gekozen renderer voegt geen runtime package of externe CSS toe;
de Gantt-feature wordt als afzonderlijke Vite-chunk lazy geladen.

Geen kandidaat bood zonder maatwerk zowel de gewenste semantische
knoppen/labels als de veilige, uitsluitend formuliergebaseerde mutatiestroom.
Alle opties kunnen technisch onder GitHub Pages werken, maar sommige vereisen
imperatieve lifecycle-bridges of aanvullende packages.

## Beslissing

Gebruik voor versie 1 een beperkte eigen renderer:

- React rendert de semantische rijlabels, filters en selecteerbare balken;
- CSS rendert de lichte grid, balken, voortgang, vandaag-lijn en mijlpaalruit;
- een niet-interactieve SVG-overlay rendert finish-to-start-lijnen;
- pure queryfuncties leveren genormaliseerde rijen en afgeleide vertraging;
- `useMemo` berekent viewport, ticks en coördinaten uitsluitend wanneer data,
  datum of zoom wijzigt;
- wijzigingen lopen via React Hook Form, Zod en
  `PlanningManagementService`; er is geen drag/drop.

## Gevolgen

- geen nieuwe productiedependency of licentierisico;
- volledige aansluiting op de bestaande visuele tokens en Nederlandstalige
  toegankelijkheidslabels;
- hash-routing en statische Pages-deployment blijven ongewijzigd;
- het bereik blijft bewust beperkt: geen resourceplanning, kritieke pad,
  werkdagkalenders, drag/drop of automatische herschikking;
- bij aantoonbare nood aan virtualisatie of geavanceerde scheduling wordt deze
  ADR heroverwogen met een gemeten performance- en toegankelijkheidsbaseline.
