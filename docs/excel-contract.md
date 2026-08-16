# Excel-datacontract — gearchiveerd

Status: **vervangen** door [het JSON-datacontract](json-contract.md) en
[ADR-011](decisions/ADR-011-json-portable-data-files.md).

Excel was tot en met applicatieversie 1.0.0 de primaire draagbare adapter. Vanaf
versie 1.1.0 kan de productie-interface uitsluitend OLV `.json`-bestanden openen
en opslaan. Daardoor is er geen afhankelijkheid meer van workbooktabellen,
werkbladen, VBA, formules of Excelweergave.

De code onder `src/infrastructure/excel` en de synthetische fixtures onder
`src/tests/fixtures/excel` blijven voorlopig behouden als legacy-regressiebron en
voor een eventuele, afzonderlijke conversietool. Ze zijn niet gekoppeld aan de
productierouter, worden niet door de header aangeboden en zijn geen tweede source
of truth.

Nieuwe functionaliteit, documentatie en releaseacceptatie moeten uitsluitend het
JSON-contract gebruiken. Een latere Excel-conversie moet expliciet worden
opgestart, JSON als uitvoer leveren en semantisch tegen het JSON-contract worden
getest.
