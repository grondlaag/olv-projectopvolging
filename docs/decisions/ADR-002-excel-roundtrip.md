# ADR-002 — Excel roundtrip als contract

Status: Accepted

## Context

Excel is de primaire draagbare database van de MVP.

## Beslissing

Canonical formaat is `.xlsx`.

Iedere substantiële import/exportwijziging vereist een semantische roundtriptest.

## Gevolgen

- data-integriteit is expliciet testbaar;
- macrofeatures zijn niet vereist;
- complexe onbekende workbookfeatures zijn best-effort.
