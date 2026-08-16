# ADR-008 — IndexedDB uitsluitend voor lokaal sessieherstel

Status: Accepted, amended by ADR-011

## Context

Een gebruiker moet na een browserreload verder kunnen met de actieve lokale
gegevensset, inclusief niet-opgeslagen wijzigingen. Automatisch herstellen zonder
zichtbare keuze kan verwarring geven over de actieve gegevensbron.

## Beslissing

- bewaar één lokale autosnapshot in IndexedDB;
- snapshotversie 2 bewaart domain records, JSON-bestandsmetadata, validatie,
  dirty state en laatste opslagtijd;
- bouw GUID- en parentindices opnieuw op bij herstel;
- toon na reload een expliciete keuze om de sessie te herstellen of te
  verwerpen;
- behandel IndexedDB niet als alternatieve draagbare database;
- wis de dirty state uitsluitend na een geslaagde JSON-download;
- herstel een bestaande versie-1-snapshot zonder workbookbuffer als domain state
  en bied het resultaat daarna als `*_hersteld.json` aan.

## Gevolgen

- een reload of tijdelijk gesloten tabblad verliest de lokale werksessie niet;
- de snapshot bevat geen volledige dubbele bronbuffer meer;
- herstel blijft een expliciete gebruikershandeling;
- browseropslag kan door beleid of gebruiker worden gewist en vervangt daarom
  geen JSON-download;
- een toekomstige O365-adapter kan dezelfde application state gebruiken.
