# export_tdb

English first, version française plus bas.

## English

export_tdb is a custom widget for [Grist](https://www.getgrist.com) that composes dashboards from the table it is linked to and the tables that descend from it: pages with text, tables, sheets, charts, images and indicators, which you print or save as PDF. It follows the row selected in Grist. It knows no table or column name: everything is chosen in the widget from the structure of your document.

### What it does

- Pages in A3, A4, A5, square or 16/9 screen formats, in portrait or landscape. Blocks are added, moved and resized with the pointer or the keyboard and never overlap. The layout is saved in the options of the widget.
- Six blocks. Text: safe Markdown with fields taken from the selected row (`{Column}`, `{Reference.Column}`) and named values, or the text of a cell that you can edit. Table: lists, groupings by one or two items with subtotals and groups that fold, cross tables, totals, filters, sorts and composed labels. Sheet: information of the selected row as small labels above their values. Chart: bar, line, pie, donut, treemap and scatter charts drawn in SVG with Apache ECharts, with nine colour palettes. Image: an attachment or an https link (Nextcloud, Google Drive and kDrive share links). Indicator: a named value in bold with a colour that follows thresholds.
- Long tables continue on the following pages with their headings repeated.
- Page numbers and a footer, undo (Ctrl+Z), and printing or PDF with the same pages as the preview.
- A course for each block, opened with the student cap of the settings panel, with examples.

### Install

1. Publish the repository with GitHub Pages: Settings, Pages, Source "Deploy from a branch", branch `main`, folder `/ (root)`.
2. The widget address is `https://YOUR-ACCOUNT.github.io/export_tdb/index.html`.
3. In Grist, add a page with a custom widget (Add, "Add Page", view type "Custom"), paste that address and choose the access level "Full document access" (the widget reads other tables and can write the cell of a text block).
4. Link the widget to a table with "Select by", then select a row.

If your Grist server is not `grist.numerique.gouv.fr`, edit two places in `index.html`: the `src` of the `grist-plugin-api.js` script and the host of `script-src` in the Content-Security-Policy line just above it.

### First steps

1. Click "Edit", then the plus button of the tool bar and choose a block. Double-click a block to open its settings.
2. Choose the table, then what makes a line (the item) and the columns with their calculation. The question marks in the panel explain each setting, and the student cap opens the course of the block.
3. Click the print button to print or save as PDF.

### Security

Scripts come from this site and from the Grist plugin API only, and the page opens no network connection (`connect-src 'none'`). Images from links and attachments are loaded by the browser as images, and user data is inserted into the page as text only, never as HTML. Nothing is sent to a third party.

### Development and tests

- `npm test` runs the unit tests with Node (no dependency to install).
- `npm run test:integration` runs the tests in a real browser with a fake Grist object. Run `npm install` once; if no browser is installed, run `npx playwright install chromium`, or set `CHROMIUM_PATH` to an existing Chromium.
- The specification is in `docs/specification.md` and the history of the versions in `CHANGELOG.md`.

### Licence

MIT, see `LICENSE`. Author: Olivier Holweck.

## Français

export_tdb est un widget personnalisé pour [Grist](https://www.getgrist.com) qui compose des tableaux de bord à partir de la table à laquelle il est lié et des tables qui en descendent : des pages avec du texte, des tableaux, des fiches, des graphiques, des images et des indicateurs, que l'on imprime ou enregistre en PDF. Il suit la ligne sélectionnée dans Grist. Il ne connaît aucun nom de table ni de colonne : tout se choisit dans le widget à partir de la structure de votre document.

### Ce qu'il fait

- Des pages aux formats A3, A4, A5, carré ou écran 16/9, en portrait ou en paysage. Les blocs s'ajoutent, se déplacent et se redimensionnent à la souris ou au clavier sans jamais se superposer. La mise en page est enregistrée dans les options du widget.
- Six blocs. Texte : du Markdown sûr avec des champs pris dans la ligne sélectionnée (`{Colonne}`, `{Reference.Colonne}`) et des valeurs nommées, ou le texte d'une cellule que l'on peut modifier. Tableau : listes, regroupements sur un ou deux items avec sous-totaux et groupes repliables, tableaux croisés, totaux, filtres, tris et libellés composés. Fiche : des informations de la ligne sélectionnée avec un petit libellé au-dessus de chaque valeur. Graphique : histogrammes, barres, courbes, secteurs, anneaux, compartimentages et nuages de points dessinés en SVG avec Apache ECharts, avec neuf palettes de couleurs. Image : une pièce jointe ou un lien https (liens de partage Nextcloud, Google Drive et kDrive). Indicateur : une valeur nommée en gras avec une couleur selon des seuils.
- Les tableaux longs continuent sur les pages suivantes avec leurs intitulés répétés.
- Numéros de page et pied de page, annulation (Ctrl+Z), impression ou PDF avec les mêmes pages que l'aperçu.
- Un cours pour chaque bloc, ouvert avec le chapeau d'étudiant du panneau de réglages, avec des exemples.

### Installation

1. Publiez le dépôt avec GitHub Pages : Settings, Pages, Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
2. L'adresse du widget est `https://VOTRE-COMPTE.github.io/export_tdb/index.html`.
3. Dans Grist, ajoutez une page avec un widget personnalisé (Ajouter, « Ajouter une page », type de vue « Personnalisée »), collez cette adresse et choisissez le niveau d'accès « Accès complet au document » (le widget lit d'autres tables et peut écrire la cellule d'un bloc texte).
4. Liez le widget à une table avec « Sélectionner par », puis sélectionnez une ligne.

Si votre serveur Grist n'est pas `grist.numerique.gouv.fr`, modifiez deux endroits dans `index.html` : l'adresse du script `grist-plugin-api.js` et l'hôte de `script-src` dans la ligne Content-Security-Policy située juste au-dessus.

### Premiers pas

1. Cliquez sur « Modifier », puis sur le bouton plus de la barre d'outils et choisissez un bloc. Double-cliquez sur un bloc pour ouvrir ses réglages.
2. Choisissez la table, puis ce qui fait une ligne (l'item) et les colonnes avec leur calcul. Les points d'interrogation du panneau expliquent chaque réglage. Le chapeau d'étudiant ouvre le cours du bloc.
3. Cliquez sur le bouton d'impression pour imprimer ou enregistrer en PDF.

### Sécurité

Les scripts viennent de ce site et de l'API des widgets Grist uniquement. La page n'ouvre aucune connexion réseau (`connect-src 'none'`). Les images des liens et des pièces jointes sont chargées par le navigateur comme des images. Les données de l'utilisateur sont insérées dans la page comme du texte, jamais comme du HTML. Rien n'est envoyé à un tiers.

### Développement et tests

- `npm test` lance les tests unitaires avec Node (aucune dépendance à installer).
- `npm run test:integration` lance les tests dans un vrai navigateur avec un faux objet Grist. Lancez une fois `npm install` ; si aucun navigateur n'est installé, lancez `npx playwright install chromium`, ou indiquez un Chromium existant avec `CHROMIUM_PATH`.
- Le cahier des charges est dans `docs/specification.md` et l'historique des versions dans `CHANGELOG.md`.

### Licence

MIT, voir `LICENSE`. Auteur : Olivier Holweck.

## Third-party code / Code tiers

- Apache ECharts 6.1.0 (Apache-2.0), with zrender (BSD-3-Clause) and tslib (0BSD): custom build in `vendor/echarts`, with its licences and the record `VENDOR.md`. It is loaded from the repository, never from the network.
- Apache ECharts 6.1.0 (Apache-2.0), avec zrender (BSD-3-Clause) et tslib (0BSD) : version personnalisée dans `vendor/echarts`, avec ses licences et la fiche `VENDOR.md`. Elle est chargée depuis le dépôt, jamais depuis le réseau.
- The link rules of the image block (Nextcloud, Google Drive and kDrive share links) come from the image_plus widget of the same author (MIT licence). / Les règles de liens du bloc Image (liens de partage Nextcloud, Google Drive et kDrive) viennent du widget image_plus du même auteur (licence MIT).
