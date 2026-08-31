# Productbrief — OLV Projectopvolging

## Productdoel

OLV Projectopvolging vervangt een moeilijk beheerbare spreadsheet/VBA-oplossing
door een rustige, relationele en volledig lokale webapp voor een zorg- en
bouwcontext.

```text
React-app = gebruikersinterface en werkruimte
JSON      = draagbaar operationeel gegevensbestand
IndexedDB = lokaal sessieherstel
```

De app draait statisch op GitHub Pages. Er is geen backend, loginserver,
serverdatabase of verplichte cloudservice. Gegevens worden alleen gelezen uit en
geschreven naar een bestand dat de gebruiker zelf kiest.

## Productprincipes

1. De UI is de werkruimte; het bestand is geen UI.
2. JSON openen en opslaan gebeurt volledig client-side.
3. De centrale state is genormaliseerd en relationeel.
4. Onbekende of corrupte relaties worden niet stilzwijgend hersteld.
5. De domein- en applicatielagen zijn onafhankelijk van het bestandsformaat.
6. Nieuwe persistente records krijgen UUID v4.
7. Financiële waarden gebruiken integer cents.
8. Niet-opgeslagen wijzigingen zijn altijd zichtbaar.
9. Context blijft behouden bij inline beheer van hoofdstuk, cluster en actor.
10. GitHub Pages bevat uitsluitend code en statische assets.

## Gebruikers en kerntaken

Projectcoördinatoren, projectmedewerkers en portfoliobeheerders moeten kunnen:

- portfolio en dashboard raadplegen;
- hoofdstukken, clusters, actoren en keuzelijsten beheren;
- projecten aanmaken en bewerken, ook zonder cluster;
- topics, actuele stand, updates en beslissingen opvolgen;
- acties en wijzigingshistoriek beheren;
- project- en portfolioplanning bekijken;
- budgetfeiten en correcties opvolgen;
- overleg, agenda en versievaste verslagen beheren;
- de volledige gegevensset lokaal bewaren en opnieuw openen.

## Start- en bestandsflow

Zonder geopende gegevensset toont de app een duidelijke startactie:

- **JSON openen** voor een bestaand bestand;
- **Nieuwe gegevensset** voor een lege operationele set met
  standaardhoofdstukken en basissuggesties.

Een bestand wordt eerst syntactisch, structureel en relationeel gecontroleerd.
Blokkerende fouten verhinderen openen. Na bevestiging wordt de genormaliseerde
state de enige actieve source of truth.

**Back-up downloaden** bouwt een nieuw, leesbaar UTF-8 JSON-bestand. Opslaan gebeurt alleen
op expliciete gebruikersactie; formulierbewerkingen veroorzaken nooit automatisch
een download.

## Navigatie

De hoofdnavigatie bevat:

- Dashboard;
- Portfolio;
- Acties;
- Planning;
- Budget;
- Overleg;
- Instellingen.

Hashrouting ondersteunt GitHub Pages en rechtstreeks herstel van dossiercontext.
Projectoverzicht, topics, journaal, planning en budget hebben stabiele routes
binnen dezelfde dossierkop. Globaal zoeken vindt projecten, topics, acties en
overleg; resultaten openen het concrete record rechtstreeks.

## Instellingen

De instellingenpagina beheert de echte domeinrecords:

- algemeen: standaardvaluta en huidige actor;
- hoofdstukken en clusters: aanmaken, bewerken en veilig deactiveren;
- actoren: contact- en rolgegevens, actief/inactief;
- keuzelijsten: projectfase, site, locatie, afdeling, budgetcategorie en
  overlegtype;
- gegevensbestand: bestandsstatus, recordaantal, openen en opslaan.

Deactiveren is geblokkeerd wanneer actieve relaties ongeldig zouden worden.
Projectformulieren bieden daarnaast compacte inline acties voor een nieuw
hoofdstuk, cluster en actor, met behoud van alle reeds ingevulde waarden.

## Projecten en clusters

- Een project hoort bij exact één hoofdstuk.
- Een cluster is optioneel en hoort bij hetzelfde hoofdstuk.
- Projecten zonder cluster staan onder **Zonder cluster**.
- Clusterwijziging sluit de bestaande open historie en opent zo nodig een
  nieuwe koppeling.
- Projectdossiers tonen status, fase, coördinator, planning, topics, acties,
  budgetstatus en clusterhistoriek zonder fake data.

## Topics, updates, beslissingen en acties

- Een topic hoort bij exact één project of cluster.
- Een topic-eigenaar is optioneel en wordt uit de actieve actors gekozen; een
  nieuwe actor kan tijdens de topicinvoer inline worden toegevoegd.
- De actuele stand verwijst naar een eigen current update.
- Bij een update of beslissing kiest de gebruiker expliciet een actieve auteur.
  De ingestelde huidige actor wordt als voorselectie gebruikt, maar is geen
  blokkade wanneer een andere auteur wordt gekozen.
- Historische updates en beslissingen worden append-only bewaard.
- Een update kan in het journaal traceerbaar worden afgesloten en heropend
  zonder de oorspronkelijke bijdrage te overschrijven.
- Acties kunnen bij project, cluster, topic of overleg horen.
- Afgeronde acties vereisen een afronddatum; wijzigingen blijven traceerbaar.

## Planning

Projecten hebben kernplanning. Topics kunnen maximaal één primaire planningentry
hebben; vrije mijlpalen zijn aparte records. Afhankelijkheden zijn initieel
finish-to-start en cycli zijn verboden. Een topic zonder timing verschijnt niet
als geplande Gantt-balk.
Start- en einddatum van een topic worden in de topiccontext beheerd en blijven
opgeslagen in die primaire planningentry.

De globale planning toont zonder projectselectie de planningdekking, het aantal
planningitems en mijlpalen, aandachtspunten en de zichtbare periode. De cijfers
volgen de actieve portfoliofilters. Hoofdstuk, cluster, project en detailregels
staan in één uitklapbare boom naast dezelfde Gantt-tijdslijn.

## Budget

Ieder BudgetRecord hoort bij één project en kan optioneel hetzelfde record aan
een topic koppelen. Daardoor telt topicimpact nooit dubbel. Aggregaties zijn pure
domeinfuncties; meer- en minwerk gebruiken hun type als tekenconventie.
Substantiële correcties maken BudgetMutation-historiek.

## Overleg en verslag

Nieuwe agendapunten zijn altijd gekoppeld aan een bestaand project of topic, of
ontstaan samen met een nieuw topic. Losse agendatekst is geen afzonderlijk
domeinrecord meer. Voorbereiding groepeert de agenda volgens hoofdstuk, cluster
en project. Tijdens verwerking blijft één punt actief: agenda links, een vaste
invoerkaart voor update/beslissing/actie in het midden en het bronjournaal
rechts. Agenda en verslag kunnen client-side als PDF worden gedownload of met
basisopmaak worden gekopieerd voor Outlook.

Overleg ondersteunt scope, deelnemers, agenda, gekoppelde bronobjecten,
beslissingen en acties. Verslagen bewaren snapshots en versies, zodat een
definitief verslag niet verandert wanneer een bronrecord later wordt aangepast.
Vanuit ieder overlegdossier kan een traceerbaar vervolgoverleg worden gemaakt;
dezelfde scope, deelnemers en open gekoppelde agendapunten worden vooringevuld
zonder het brondossier te wijzigen.

Vanuit een project of topic kan de gebruiker in hetzelfde dossier kiezen op welk
toekomstig conceptoverleg het besproken moet worden. De app toont alleen
overleggen waarvan de portfolio-, hoofdstuk-, cluster- of projectscope bij het
bronrecord past. De koppeling is meteen een bestaand `AgendaItem`; er ontstaat
geen tweede overlegrelatie en hetzelfde bronrecord wordt niet dubbel op dezelfde
agenda geplaatst.

## Privacy en beveiliging

- Geen operationele gegevensbestanden in Git of `dist`.
- Geen projectdata in netwerkverkeer.
- Geen browsersecrets of private omgevingsvariabelen.
- IndexedDB is uitsluitend lokaal herstel, geen gedeelde database.
- Externe documenten blijven referenties; de app slaat geen bestanden zelf op.

## Buiten scope

- backend of serverdatabase;
- realtime samenwerking;
- authenticatie en autorisatie;
- plan-pins, interactieve plannen en PDF/SVG-pinfunctionaliteit;
- automatische synchronisatie met O365;
- operationele Excel-import of -export.

## Acceptatie

De release is aanvaard wanneer een gebruiker een nieuwe gegevensset kan starten,
de structuur en instellingen kan beheren, alle bestaande hoofdflows kan uitvoeren,
het resultaat als JSON kan opslaan, opnieuw kan openen en semantisch dezelfde
records en relaties terugvindt. Formatter, lint, typecheck, unit/integratie,
build, Playwright, performance- en release-audit moeten slagen.

## Dagelijkse UX

De primaire workflow begint bij “Mijn werk” en blijft vanuit elke route
toegankelijk via globaal zoeken en “+ Nieuw”. Portfolio ondersteunt compacte
snelle selecties, inklapbare detailfilters en zichtbare filterchips.
Projectdossiers gebruiken overal dezelfde volledige projecteditor. De editor
keert na bewaren terug naar het dossieronderdeel van herkomst en bewaart alle
projectvelden, inclusief omvang. Niet-bewaarde complexe formulierinvoer wordt
bij interne navigatie en venstersluiten beschermd. Er ontstaat geen tweede
UI-opslagmodel. Een projectstatusmoment is inhoudelijke journaalinformatie en
blijft onderscheiden van de levenscyclusstatus. Deelbare werkcontext zoals
tabs, filters, groepering, zoom en overlegmodus staat in de hash-URL.

De globale “+ Nieuw”-actie volgt de geopende context. In een project verschijnen
direct een projecttopic, projectactie en overleg met vaste projectscope; bij een
topic, cluster of overleg worden alleen relevante contextacties aangeboden.
Sneltoets `N` opent deze laag en `?` toont het compacte sneltoetsoverzicht.

Recente project-, topic- en overlegdossiers staan onder **Snel bereikbaar** en
kunnen lokaal als favoriet worden vastgezet. Acties, planning, budget en overleg
ondersteunen benoemde weergaven op basis van hun deelbare URL-filters. Sterke
tabellen kunnen een lokale compacte dichtheid en relevante zichtbare kolommen
bewaren. Deze persoonlijke werkruimtevoorkeuren zijn apparaatgebonden en maken
geen deel uit van het operationele JSON-bestand.

De actielijst ondersteunt een bewuste bulkhandeling voor eigenaar en status.
Selectie alleen wijzigt niets; na bevestiging gebruikt elke actie dezelfde
validatie en traceerbare historie als een individuele wijziging.

Werkvlakken volgen progressive disclosure. Paginatitel, geselecteerd record,
actuele stand, hoofdstatus, primaire actie en financiële kernfeiten blijven
zichtbaar. Detailfilters, metadata, planning- en budgetdetails, overlegverleden,
actorbeheer en secundaire acties zijn samengevat en uitklapbaar. Updates,
beslissingen en acties starten vanuit dezelfde compacte composer; er staat niet
op elk scherm permanent een volledig formulier open.

De financiële portefeuille toont vijf controleerbare typesommen en een
ingeklapte hoofdstuk/cluster/projectboom. De overlegverwerking biedt daarnaast
een focusmodus met vorig/volgend punt en een directe markering `Punt besproken`.
Deze UI-state wijzigt de operationele gegevensset niet; alleen expliciete saves
lopen via de bestaande applicatieservices.
