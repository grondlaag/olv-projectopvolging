# ADR-005 — Genormaliseerd planningmodel

Status: Accepted

## Context

Topics kunnen optionele timing hebben en moeten in Gantt kunnen verschijnen.

## Beslissing

Topic bevat geen duplicatieve planningdatums.

Timing staat in `PlanningEntry`.

Project behoudt kernstart/eind/progress als projectsamenvatting.

Dependencies staan in een aparte relatietabel.

## Gevolgen

- topic zonder planning blijft eenvoudig;
- Ganttmodel is uniform;
- dependencies zijn normaliseerbaar;
- geen dubbele topicdatum-source.
