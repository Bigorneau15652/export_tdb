# export_tdb

English first, version française plus bas.

## English

export_tdb will be a custom widget for [Grist](https://www.getgrist.com) that composes dashboards (Markdown text, tables with totals, charts, images and indicators) from a table and the tables linked to it, and prints them or saves them as PDF. It is built in small versions; the specification is in `docs/specification.md`.

Status: version 0.6.2. The Dashboard tab shows pages (A3, A4, A5, square or 16/9 screen, portrait or landscape) on which blocks are added, moved, resized and deleted with the pointer or the keyboard; blocks never overlap and the layout is saved in the options of the widget. Text blocks draw safe Markdown with fields taken from the selected row (`{Column}`, `{Reference.Column}`) and can read and write a Text cell of that row. Table blocks show lists and groupings with totals, filters and sorts, built with the same menus as the query lab. Sheet blocks show information of the selected row as small labels above their values. Chart, image and indicator blocks are empty frames for now. The Explorer tab reads the structure of your document and tests the Grist functions that the widget needs. The Query lab tab lets you try calculations on your real data.

### Install

1. Publish the repository with GitHub Pages: Settings, Pages, Source "Deploy from a branch", branch `main`, folder `/ (root)`.
2. The widget address is `https://YOUR-ACCOUNT.github.io/export_tdb/index.html`.
3. In Grist, add a page with a custom widget (Add, "Add Page", view type "Custom"), paste that address and choose the access level "Full document access" (the explorer reads other tables).
4. Select a row of the table: the exploration starts.

If your Grist server is not `grist.numerique.gouv.fr`, edit two places in `index.html`: the `src` of the `grist-plugin-api.js` script and the host of `script-src` in the Content-Security-Policy line just above it.

### Using the explorer

The explorer shows the linked table, the tables that descend from it, a counter of the rows seen while you move in the table, two tests and a report. By default the report holds only the shape of the values (for example "list of references") and no content of your document; tick the box to show values too. The attachment test needs a selected row that has an attachment. The write test is optional: after your confirmation it writes a marker in the text column you choose, reads it back, then puts the original value back, with the two methods of the API.

### Using the query lab

Select a row in Grist, wait for the exploration to finish, then open the Query lab tab. The lab works in three steps. First the starting row: the selected row, or something it belongs to (for example the building of a selected room): the page shows which row it is. Then the table to calculate on (for example the rooms) and the link that attaches its rows to the starting row; the lab lists the chains of references and puts the best first (summary tables made by Grist and chains through lists come last and are labelled). Then the calculation: group by one or two columns, a sum, average, minimum, maximum or count of a column, and up to two filters. A filter compares a column (or a column reached through a reference, written `Reference > Column`) with a typed value, with a field of the starting row or with its number. The result is a table with a total line, the number of rows kept and the time spent. It is calculated again when you change row in Grist (you can turn this off). Two different rows that have the same label stay apart unless you tick the merge box. Nothing is saved in the document. The lab reads the tables it needs once and keeps them until you click "Reload the data".

### Security

Scripts come from this site and from the Grist plugin API only, and the page opens no network connection (`connect-src 'none'`). Nothing is stored in the browser and nothing is sent to a third party. The only write is the test that you confirm.

### Development and tests

- `npm test` runs the unit tests with Node (no dependency to install): schema, shapes, report, values, tables in memory, rows and filters, grouping and cross tables, expressions and formats, with random comparisons against naive calculations.
- `npm run test:integration` runs the tests in a real browser with a fake Grist object. Run `npm install` once; if no browser is installed, run `npx playwright install chromium`, or set `CHROMIUM_PATH` to an existing Chromium.

### Licence

MIT, see `LICENSE`. Author: Olivier Holweck.

## Français

export_tdb sera un widget personnalisé pour [Grist](https://www.getgrist.com) qui compose des tableaux de bord (texte en Markdown, tableaux avec totaux, graphiques, images et indicateurs) à partir d'une table et des tables qui lui sont liées, et les imprime ou les enregistre en PDF. Il est construit par petites versions ; le cahier des charges est dans `docs/specification.md`.

État : version 0.6.2. L'onglet Tableau de bord affiche des pages (A3, A4, A5, carré ou écran 16/9, en portrait ou en paysage) sur lesquelles on ajoute, déplace, redimensionne et supprime des blocs à la souris ou au clavier ; les blocs ne se superposent jamais et la mise en page est enregistrée dans les options du widget. Les blocs texte affichent du Markdown sûr avec des champs pris dans la ligne sélectionnée (`{Colonne}`, `{Reference.Colonne}`) et peuvent lire et écrire une cellule Texte de cette ligne. Les blocs tableau affichent des listes et des regroupements avec totaux, filtres et tris, construits avec les mêmes menus que le laboratoire. Les blocs fiche affichent des informations de la ligne sélectionnée avec un petit libellé au-dessus de chaque valeur. Les blocs graphique, image et indicateur sont encore des cadres vides. L'onglet Explorateur lit la structure de votre document et teste les fonctions de Grist dont le widget a besoin. L'onglet Laboratoire de requêtes permet d'essayer des calculs sur vos vraies données.

### Installation

1. Publiez le dépôt avec GitHub Pages : Settings, Pages, Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
2. L'adresse du widget est `https://VOTRE-COMPTE.github.io/export_tdb/index.html`.
3. Dans Grist, ajoutez une page avec un widget personnalisé (Ajouter, « Ajouter une page », type de vue « Personnalisée »), collez cette adresse et choisissez le niveau d'accès « Accès complet au document » (l'explorateur lit d'autres tables).
4. Sélectionnez une ligne de la table : l'exploration démarre.

Si votre serveur Grist n'est pas `grist.numerique.gouv.fr`, modifiez deux endroits dans `index.html` : l'adresse du script `grist-plugin-api.js` et l'hôte de `script-src` dans la ligne Content-Security-Policy située juste au-dessus.

### Utilisation de l'explorateur

L'explorateur affiche la table liée, les tables qui en descendent, un compteur des lignes vues quand vous changez de ligne, deux tests et un rapport. Par défaut le rapport ne contient que la forme des valeurs (par exemple « liste de références ») et aucun contenu de votre document ; cochez la case pour montrer aussi les valeurs. Le test des pièces jointes demande une ligne sélectionnée qui en possède une. Le test d'écriture est facultatif : après votre confirmation il écrit un marqueur dans la colonne de texte choisie, le relit, puis remet la valeur d'origine, avec les deux méthodes de l'API.

### Utilisation du laboratoire de requêtes

Sélectionnez une ligne dans Grist, attendez la fin de l'exploration, puis ouvrez l'onglet Laboratoire de requêtes. Le laboratoire fonctionne en trois temps. D'abord la ligne de départ : la ligne sélectionnée, ou un élément auquel elle est rattachée (par exemple le bâtiment d'une salle sélectionnée) ; la page indique de quelle ligne il s'agit. Ensuite la table sur laquelle calculer (par exemple les salles) et le lien qui rattache ses lignes à la ligne de départ ; le laboratoire liste les chaînes de références et met la meilleure en premier (les tables de synthèse créées par Grist et les chaînes qui passent par une liste viennent en dernier et sont signalées). Enfin le calcul : regroupement sur une ou deux colonnes, somme, moyenne, minimum, maximum ou nombre d'une colonne, et jusqu'à deux filtres. Un filtre compare une colonne (ou une colonne atteinte par une référence, écrite `Référence > Colonne`) avec une valeur saisie, avec un champ de la ligne de départ ou avec son numéro. Le résultat est un tableau avec une ligne de total, le nombre de lignes retenues et le temps passé. Il est recalculé quand vous changez de ligne dans Grist (vous pouvez le désactiver). Deux lignes différentes qui portent le même libellé restent séparées, sauf si vous cochez la case de fusion. Rien n'est enregistré dans le document. Le laboratoire lit une fois les tables dont il a besoin et les garde jusqu'à ce que vous cliquiez sur « Recharger les données ».

### Sécurité

Les scripts viennent de ce site et de l'API des widgets Grist uniquement, et la page n'ouvre aucune connexion réseau (`connect-src 'none'`). Rien n'est stocké dans le navigateur et rien n'est envoyé à un tiers. La seule écriture est le test que vous confirmez.

### Développement et tests

- `npm test` lance les tests unitaires avec Node (aucune dépendance à installer) : structure, formes, rapport, valeurs, tables en mémoire, lignes et filtres, regroupements et tableaux croisés, expressions et formats, avec des comparaisons aléatoires à un calcul naïf.
- `npm run test:integration` lance les tests dans un vrai navigateur avec un faux objet Grist. Lancez une fois `npm install` ; si aucun navigateur n'est installé, lancez `npx playwright install chromium`, ou indiquez un Chromium existant avec `CHROMIUM_PATH`.

### Licence

MIT, voir `LICENSE`. Auteur : Olivier Holweck.
