# ADR-001 — Storage adapters

Status: Accepted

## Context

Versie 1.1 gebruikt een draagbaar JSON-bestand. Later kan O365 de opslag
overnemen. De opslagkeuze mag niet doorlekken naar domein of React UI.

## Beslissing

Domein en use cases gebruiken repository-/gatewayinterfaces. De JSON-gateway en
IndexedDB-sessieadapter zijn infrastructuurimplementaties. De historische
Exceladapter blijft geïsoleerde legacycode.

## Gevolgen

Voordelen:

- frontend blijft migreerbaar;
- in-memory contracttests;
- bestandsmapping geïsoleerd.

Kost:

- meer initiële structuur;
- mappinglaag vereist discipline.
