# export_tdb

English first, version française plus bas.

## English

export_tdb will be a custom widget for [Grist](https://www.getgrist.com) that composes dashboards (Markdown text, tables with totals, charts, images and indicators) from a table and the tables linked to it, and prints them or saves them as PDF. It is built in small versions; the specification is in `docs/specification.md`.

Status: version 0.1, the explorer. It does not compose dashboards yet. It reads the structure of your document and tests the Grist functions that the dashboard widget needs, then produces a report that you copy and send to the developer.

### Install

1. Publish the repository with GitHub Pages: Settings, Pages, Source "Deploy from a branch", branch `main`, folder `/ (root)`.
2. The widget address is `https://YOUR-ACCOUNT.github.io/export_tdb/index.html`.
3. In Grist, add a page with a custom widget (Add, "Add Page", view type "Custom"), paste that address and choose the access level "Full document access" (the explorer reads other tables).
4. Select a row of the table: the exploration starts.

If your Grist server is not `grist.numerique.gouv.fr`, edit two places in `index.html`: the `src` of the `grist-plugin-api.js` script and the host of `script-src` in the Content-Security-Policy line just above it.

### Using the explorer

The explorer shows the linked table, the tables that descend from it, a counter of the rows seen while you move in the table, two tests and a report. By default the report holds only the shape of the values (for example "list of references") and no content of your document; tick the box to show values too. The attachment test needs a selected row that has an attachment. The write test is optional: after your confirmation it writes a marker in the text column you choose, reads it back, then puts the original value back, with the two methods of the API.

### Security

Scripts come from this site and from the Grist plugin API only, and the page opens no network connection (`connect-src 'none'`). Nothing is stored in the browser and nothing is sent to a third party. The only write is the test that you confirm.

### Development and tests

- `npm test` runs the unit tests with Node (no dependency to install).
- `npm run test:integration` runs the tests in a real browser with a fake Grist object. Run `npm install` once; if no browser is installed, run `npx playwright install chromium`, or set `CHROMIUM_PATH` to an existing Chromium.

### Licence

MIT, see `LICENSE`. Author: Olivier Holweck.

## Français

export_tdb sera un widget personnalisé pour [Grist](https://www.getgrist.com) qui compose des tableaux de bord (texte en Markdown, tableaux avec totaux, graphiques, images et indicateurs) à partir d'une table et des tables qui lui sont liées, et les imprime ou les enregistre en PDF. Il est construit par petites versions ; le cahier des charges est dans `docs/specification.md`.

État : version 0.1, l'explorateur. Il ne compose pas encore de tableaux de bord. Il lit la structure de votre document et teste les fonctions de Grist dont le widget aura besoin, puis produit un rapport que vous copiez et envoyez au développeur.

### Installation

1. Publiez le dépôt avec GitHub Pages : Settings, Pages, Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
2. L'adresse du widget est `https://VOTRE-COMPTE.github.io/export_tdb/index.html`.
3. Dans Grist, ajoutez une page avec un widget personnalisé (Ajouter, « Ajouter une page », type de vue « Personnalisée »), collez cette adresse et choisissez le niveau d'accès « Accès complet au document » (l'explorateur lit d'autres tables).
4. Sélectionnez une ligne de la table : l'exploration démarre.

Si votre serveur Grist n'est pas `grist.numerique.gouv.fr`, modifiez deux endroits dans `index.html` : l'adresse du script `grist-plugin-api.js` et l'hôte de `script-src` dans la ligne Content-Security-Policy située juste au-dessus.

### Utilisation de l'explorateur

L'explorateur affiche la table liée, les tables qui en descendent, un compteur des lignes vues quand vous changez de ligne, deux tests et un rapport. Par défaut le rapport ne contient que la forme des valeurs (par exemple « liste de références ») et aucun contenu de votre document ; cochez la case pour montrer aussi les valeurs. Le test des pièces jointes demande une ligne sélectionnée qui en possède une. Le test d'écriture est facultatif : après votre confirmation il écrit un marqueur dans la colonne de texte choisie, le relit, puis remet la valeur d'origine, avec les deux méthodes de l'API.

### Sécurité

Les scripts viennent de ce site et de l'API des widgets Grist uniquement, et la page n'ouvre aucune connexion réseau (`connect-src 'none'`). Rien n'est stocké dans le navigateur et rien n'est envoyé à un tiers. La seule écriture est le test que vous confirmez.

### Développement et tests

- `npm test` lance les tests unitaires avec Node (aucune dépendance à installer).
- `npm run test:integration` lance les tests dans un vrai navigateur avec un faux objet Grist. Lancez une fois `npm install` ; si aucun navigateur n'est installé, lancez `npx playwright install chromium`, ou indiquez un Chromium existant avec `CHROMIUM_PATH`.

### Licence

MIT, voir `LICENSE`. Auteur : Olivier Holweck.
