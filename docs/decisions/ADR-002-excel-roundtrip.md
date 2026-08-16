# ADR-002 — Excel roundtrip als contract

Status: Superseded by ADR-011

Deze beslissing beschrijft het contract tot en met appversie 1.0.0. De
legacyroundtriptests blijven bestaan, maar zijn geen productieacceptatie meer.

## Context

Excel is de primaire draagbare database van de MVP.

## Beslissing

Canonical formaat is `.xlsx`.

Iedere substantiële import/exportwijziging vereist een semantische roundtriptest.

## Gevolgen

- data-integriteit is expliciet testbaar;
- macrofeatures zijn niet vereist;
- complexe onbekende workbookfeatures zijn best-effort.
