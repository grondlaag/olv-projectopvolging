# ADR-008 — IndexedDB uitsluitend voor lokaal sessieherstel

Status: Accepted

## Context

Een gebruiker moet na een browserreload verder kunnen met een lokaal geladen
workbook, inclusief niet-geëxporteerde wijzigingen. Excel blijft tegelijk de
canonical draagbare database. Automatisch herstellen zonder zichtbare keuze kan
verwarring geven over de actieve gegevensbron.

## Beslissing

- bewaar één lokale autosnapshot in IndexedDB;
- bewaar domain records, originele workbookbuffer, bestandsmetadata,
  dirty-state en laatste exporttijd;
- bouw GUID-indices opnieuw op bij herstel;
- toon na reload een expliciete keuze om de sessie te herstellen of te
  verwerpen;
- behandel IndexedDB niet als alternatieve canonical database;
- wis de dirty-state uitsluitend na een geslaagde Excelexport.

## Gevolgen

- een reload of tijdelijk gesloten tabblad verliest de lokale werksessie niet;
- onbekende workbookbladen kunnen bij een latere export nog vanuit de originele
  buffer best-effort worden behouden;
- herstel blijft een expliciete gebruikershandeling;
- browseropslag kan worden verwijderd door browserbeleid of de gebruiker en is
  daarom geen vervanging voor export;
- toekomstige O365-opslag kan dezelfde application state gebruiken zonder dit
  browseropslagcontract over te nemen.
