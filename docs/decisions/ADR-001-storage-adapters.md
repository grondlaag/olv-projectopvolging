# ADR-001 — Storage adapters

Status: Accepted

## Context

Versie 1 gebruikt Excel. Later kan O365 de opslag overnemen.

## Beslissing

Domein en use cases gebruiken repositoryinterfaces.

Excel is één infrastructuurimplementatie.

## Gevolgen

Voordelen:

- frontend blijft migreerbaar;
- in-memory tests;
- Excelmapping geïsoleerd.

Kost:

- meer initiële structuur;
- mappinglaag vereist discipline.
