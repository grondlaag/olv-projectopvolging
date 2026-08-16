# UX-audit fase 9

> Historisch auditdocument voor release 1.0.0. De Excel-import/-exportbevindingen
> zijn vanaf 1.1.0 vervangen door de JSON-bestandsflow uit ADR-011; overige
> visuele en toegankelijkheidsbevindingen blijven als ontwerpgeschiedenis staan.

Datum: 2026-08-09

## Methode

De productiebuild is vóór wijzigingen doorlopen met de bestaande Playwrightflows
voor import, portfolio, projecten, topics, acties, planning, budget, overleg,
verslag, export en sessieherstel. De audit combineert de gemeten browseracties
met inspectie van routes, formulieren, drawers, querymodellen en responsive CSS.

De bestaande suite telde vóór consolidatie 10 groene browserflows. De omvang per
fase was: projectbeheer 37 interacties, topics 36, acties 39, planning 44, budget
36 en overleg 69. Een interactie is een click, fill, selectie, checkbox of lokale
bestandskeuze; asserts en automatische routewissels tellen niet mee.

## Auditmatrix A–V

| Flow | Stappen / clicks vóór | Contextwissels | Verplichte invoer | Belangrijkste frictie of risico | Besluit fase 9 |
| --- | ---: | ---: | --- | --- | --- |
| A. App openen | 1 / 0 | 0 | geen | Lege app geeft correcte laadactie | Behouden; globale foutgrens toevoegen |
| B. Excel importeren | 4 / 3 | 1 drawer | bestand | Goede lokale validatie, maar fouttekst kan technisch lekken | Fouten vertalen, Esc/focus en privacytest |
| C. Dashboard | 1 / 0 | 0 | geen | Zes KPI's maar veel vervolsecties | Uitzonderingen laten primeren, visuele ruis beperken |
| D. Portfolio | 2 / 1 | 1 route | geen | Sterke lijst; relationele filters niet doorzoekbaar | Zoekbare selectie en debounced zoeken behouden |
| E. Project openen | 2 / 1 | 1 route | geen | Dossierkern is sterk, aandacht/recent nog verspreid | Overzicht als operationele homepage aanvullen |
| F. Project maken | 7 / 2 | 1 full page | code, titel, hoofdstuk | Veel optionele velden meteen zichtbaar | Full page behouden; duidelijke secties en parentstate bewaken |
| G. Project wijzigen | 4 / 2 | 1 full page | bestaande basis | Context keert correct terug | Feedbacktaal uniformeren |
| H. Cluster toevoegen | 5 / 2 | 1 inline drawer | naam/code | Parentstate blijft al behouden | Zoekbaar maken; Esc sluit alleen drawer |
| I. Actor toevoegen | 8 / 2 | 1 inline drawer | naam/type | Te veel optionele velden direct zichtbaar | Progressive disclosure en zoekbare selectie |
| J. Topic toevoegen | 7 / 2 | 1 drawer | code, titel, context | Code krijgt evenveel nadruk als inhoud; actor niet inline | Inhoud eerst, code onder meer opties, actor inline |
| K. Actuele stand | 5 / 3 | 1 drawer | tekst | Meest gebruikte taak opent volledig paneel | Inline quick entry, standaard journaal, Ctrl+Enter |
| L. Update | 4 / 3 | 1 drawer | tekst | Datum/type zichtbaar hoewel defaults volstaan | Inline quick entry; metadata onder meer opties |
| M. Beslissing | 4 / 3 | 1 drawer | tekst | Zelfde frictie als update | Inline quick entry in topiccontext |
| N. Actie toevoegen | 7 / 2 | 1 drawer | titel/eigenaar | Primair formulier is al compact | Behouden, searchable eigenaar, Esc/Ctrl+Enter |
| O. Actie afronden | 5 / 3 | 1 drawer | status | Volledig formulier nodig voor één statuswijziging | Snelle statusselectie in werklijst |
| P. Planning toevoegen | 7 / 2 | 1 drawer | titel/datums | Betrouwbaar formulier; geen drag/drop | Behouden, details progressief en Esc |
| Q. Gantt raadplegen | 2 / 1 | 1 route | geen | Read-only-first is duidelijk | Behouden; route/performance/responsive testen |
| R. Budgetitem | 10 / 2 | 1 drawer | type/categorie/omschrijving/bedrag/datum | Analytische metadata te prominent | Kernvelden eerst, context onder meer opties |
| S. Overleg voorbereiden | 12 / 4 | 1 full page + drawer | titel/datum/scope | Correcte workflow maar veel relationele selects | Zoekbare relaties; context automatisch houden |
| T. Overleg verwerken | 14 / 7 | 1 dossier + drawers | bespreektekst | Bijdragen zijn contextueel, maar panelen blijven zwaar | Compacte agendapuntacties en shortcuts |
| U. Verslag bekijken | 4 / 2 | 0 binnen dossier | geen | Professionele snapshot/printweergave aanwezig | Behouden; print- en route-smoke uitbreiden |
| V. Excel exporteren | 2 / 1 | 0 | geen | Status gebruikt technische taal; foutfeedback ontbreekt | Menselijke dirty/exportstatus en succes-/foutmelding |

## Geprioriteerde bevindingen

1. Actuele stand, update en beslissing zijn kleine transacties maar gebruiken
   dezelfde drawer als middelgrote records.
2. Globaal zoeken stuurt uitsluitend naar een projectfilter en vindt geen
   topics, actuele standen, bijdragen, acties of overleg.
3. Actiestatus vraagt een volledige editflow; de operationele werklijst mist
   expliciete snelviews zoals mijn/open/achterstallig.
4. Relatieselecties zijn gewone selects en schalen slecht bij veel actoren,
   projecten en topics.
5. Sessietaal bevat `Clean` en `export vereist`; dit beschrijft techniek in
   plaats van de taak van de gebruiker.
6. Drawers reageren niet consequent op Esc en quick entry ondersteunt geen
   Ctrl/Cmd+Enter.
7. `meetingsForProject` scant alle overleggen; `meetingsByProject` ontbreekt in
   de genormaliseerde indices.
8. Er is geen globale React error boundary, waardoor een renderfout de hele app
   kan uitschakelen.
9. De Excelchunk is gemeten groot (963,94 kB minified), maar is al lazy en wordt
   alleen bij import/export geladen; optimalisatie vereist meting, geen
   architectuurwissel.

## Grenzen

- Financiële kern-KPI's blijven `Regel vereist` conform ADR-006.
- Gantt blijft read-only-first; drag/drop wordt niet toegevoegd.
- Overleg blijft full page; agendaobjecten blijven bestaande domeinrecords.
- Er wordt geen nieuwe productmodule of parallel topic-/actie-/budgetmodel
  geïntroduceerd.

## Resultaat na consolidatie

- globaal zoeken opent project, cluster, topic, actuele stand, update,
  beslissing, actie of overleg rechtstreeks;
- actuele stand, update en beslissing gebruiken quick entry zonder
  contextwissel;
- relationele selecties zijn doorzoekbaar en inline actor-/clusterinvoer bewaart
  het parentformulier;
- acties hebben operationele snelviews en een snelle statuswijziging met
  historiek;
- sessie- en exportfeedback gebruikt mensentaal;
- drawers reageren consequent op Esc, beheren focus en ondersteunen waar
  relevant Ctrl/Cmd+Enter;
- projectoverzicht groepeert aandacht, actuele topics, acties, recente
  beslissingen, activiteit, budget en overleg;
- `meetingsByProject`, globale foutopvang en Excel-worker zijn als gerichte
  hardening toegevoegd;
- de productiepreview is visueel en geautomatiseerd gecontroleerd op de vijf
  vereiste breedtes.
