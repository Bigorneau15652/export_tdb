Cahier des charges du widget export_tdb (compositeur de tableaux de bord pour Grist)

Ce document décrit ce que le widget doit faire et comment il est construit. Il est la référence des sessions de travail.

1. Contexte et objectif

Le mainteneur, Olivier Holweck, n'est pas programmeur. Il construit un widget personnalisé pour Grist, hébergé sur GitHub Pages dans le dépôt public Bigorneau15652/export_tdb, sans étape de compilation. Le widget est un compositeur de tableaux de bord : il lit la table à laquelle il est lié ainsi que toutes les tables qui lui sont rattachées par des colonnes de référence. Il permet de composer une page (ou plusieurs) avec des blocs de texte en Markdown, des tableaux avec lignes et colonnes de totaux, des graphiques, des images et des indicateurs. Il se met à jour quand on change de ligne dans Grist. Il s'imprime et s'exporte en PDF.

Le widget doit s'adapter à n'importe quelle table de n'importe quel document Grist. Il ne connaît donc aucun nom de table ni de colonne : tout se choisit dans l'interface à partir du schéma lu dans le document. C'est la différence essentielle avec le widget dashboard-batiment, qui est écrit pour sept tables précises.

Ce widget sera proposé à la communauté Grist Gouv.

Un audit de sécurité et de performance suivra le développement : chaque choix est fait en pensant à cet audit dès le départ.

2. Ce que l'analyse du widget dashboard-batiment apprend

Le widget existant (un fichier index.html de 1 500 lignes dans le dépôt map) lit sept tables avec fetchTable, a deux menus Site et Bâtiment, calcule tout dans le navigateur et imprime en A4 paysage sur deux pages. Ses leçons pour le nouveau widget sont les suivantes.

Ce qui marche et doit être repris : l'accès complet au document avec fetchTable sur plusieurs tables, la lecture des pièces jointes avec getAccessToken, l'enregistrement des réglages dans les options du widget, l'impression par CSS avec @page, les sauts de page forcés, les polices système, la mise en forme française des nombres.

Ce qui doit être changé : les bibliothèques Chart.js, chartjs-plugin-datalabels et Leaflet sont chargées depuis un CDN, ce qui est interdit par la règle du projet (tout est copié dans le dépôt avec sa licence). Les noms de tables et de colonnes sont écrits dans le code. Les calculs sont faits par des fonctions écrites à la main pour chaque tableau, alors qu'il faut un moteur générique de filtres, de regroupements et d'agrégats. Le fichier unique de 1 500 lignes mélange lecture des données, calculs et affichage : le nouveau widget est découpé en modules purs testés avec Node et en modules d'affichage.

Les deux autres widgets du dépôt map (carte-france et whackacell) prouvent que fetchTable fonctionne sur les tables de métadonnées _grist_Tables et _grist_Tables_column avec l'accès complet, et que applyUserActions fonctionne pour écrire. Cela donne le chemin pour découvrir le schéma (tables, colonnes, types, références) et pour écrire le texte d'un bloc dans une cellule. Les formats exacts des valeurs (listes de références, dates, pièces jointes) devront être relevés lors de la première version (partie 14, version 0.1).

3. Fonctions imposées par les documents de référence

Les fiches de référence que le widget doit pouvoir reproduire sont des documents A4 en paysage de plusieurs pages. Elles imposent des fonctions qui conditionnent l'architecture : une bande d'identité (tableau d'une seule ligne dont les intitulés sont au-dessus des valeurs), des cartes d'indicateurs avec une valeur en gras et une couleur selon un seuil (une valeur peut être le ratio de deux agrégats, d'où un cinquième type de bloc, l'indicateur, et des valeurs nommées), des tableaux avec ligne de total séparée par un trait plus épais, des tableaux croisés découpés en tranches de colonnes (c'est le sens du paramètre « nombre de colonnes »), des tableaux regroupés à deux niveaux avec sous-totaux, libellés remplacés et ordre imposé, des tableaux longs qui continuent sur la page suivante avec leurs intitulés répétés, des graphiques en anneau avec pourcentages, des libellés composés de plusieurs colonnes, des textes contenant des valeurs calculées, des filtres dont la valeur vient de la ligne sélectionnée et des colonnes atteintes à travers des références.

4. Règles de travail (à respecter à chaque session)

Dialogue : parler à Olivier en français, avec des mots simples et sans flatterie. Poser les questions qui lèvent les ambiguïtés avant de programmer, par petits groupes, avec une recommandation. Travailler par petites versions que l'auteur teste une par une dans Grist. Expliquer chaque étape GitHub avec le nom exact des boutons (fusionner une demande de fusion, activer GitHub Pages, mettre à jour le widget). Aucun emoji dans les textes destinés à être copiés dans Word, aucun trait horizontal, peu de puces. En français, jamais de virgule avant « et » et pas de tiret long au milieu d'une phrase.

Code : toute chaîne JavaScript s'écrit entre accents graves (template literals), jamais entre apostrophes ni guillemets, pour que les apostrophes françaises ne provoquent pas d'erreur de syntaxe. Les identifiants et les commentaires sont en anglais, avec un court bloc au-dessus de chaque fichier et de chaque fonction. Les textes affichés passent par un fichier de traduction français et anglais. Aucun eval ni new Function. Aucune bibliothèque chargée depuis un CDN : tout est copié dans le dépôt avec sa licence et un fichier VENDOR.md qui note la version, la source et les vérifications faites. Aucune nouvelle dépendance sans l'accord d'Olivier. Aucune donnée réelle dans le dépôt : ni noms de tables ou de colonnes de la note privée Grist-SIPI-informations, ni chiffres des documents de référence, ni liens réels. Les jeux de test utilisent des données inventées (un schéma Sites, Bâtiments, Étages, Locaux et Types d'usage fictif).

Tests et versions : un test unitaire Node par module pur, et un scénario Playwright par comportement visible, avec un faux objet grist. Les tests d'intégration se lancent à la main avec npm run test:integration. Chaque version a une section dans CHANGELOG.md, un numéro dans package.json et un paramètre ?v=X.Y.Z dans les pages. Message de commit : Version 0.1.0 : courte description en français. Travailler sur une branche, pousser, ouvrir une demande de fusion en brouillon. Après chaque version, donner à Olivier la liste des tests manuels à faire dans Grist, car le widget ne peut pas être essayé dans Grist depuis une session.

Interdits : ne pas modifier les clés des options déjà enregistrées une fois une version publiée (les mises en page enregistrées en dépendent) sans prévoir une migration versionnée. Ne pas copier de code sous licence GPL.

5. Architecture générale

Le widget est un dossier de fichiers statiques sans compilation. La logique est répartie en modules purs (sans accès à la page ni à Grist), testés avec Node : schéma et chemins de colonnes, filtres, agrégats, regroupements, tableaux croisés, expressions, formats de nombres et de dates, moteur de mise en page (grille et collisions), rendu Markdown vers un arbre de nœuds, validation des modèles. Autour de ces modules, des modules d'affichage construisent le DOM avec createElement et textContent : un canevas de pages, des blocs par type, un panneau de paramètres, la fenêtre d'impression. Un module d'accès à Grist isole tous les appels à l'API (métadonnées, fetchTable, onRecord, setOptions, écriture d'une cellule, jeton de pièce jointe) pour que le reste soit testable avec un faux Grist.

Le flux de données est le suivant. Grist appelle onRecord avec la ligne sélectionnée de la table liée. Le module de schéma sait quelles tables descendent de cette table et par quels chemins. Chaque bloc déclare ce dont il a besoin (une table, un chemin, des filtres, des colonnes). Un gestionnaire de données charge les tables nécessaires une seule fois, les garde en colonnes et les réutilise. Chaque bloc calcule son résultat (lignes filtrées, agrégats) de façon pure à partir de ces colonnes et de la ligne sélectionnée. Le résultat est mémorisé tant que ni le modèle du bloc ni les données ni la ligne ne changent. L'affichage dessine le résultat. La fenêtre d'impression reçoit les résultats déjà calculés, sans accès à Grist.

6. Modèle du tableau de bord (enregistré dans les options du widget)

Tout le modèle est un objet JSON enregistré avec grist.setOptions. Il contient un numéro de version du format, les paramètres de page (format, orientation, marges, palette), la liste des valeurs nommées et la liste des blocs. Chaque bloc a un identifiant, un type, un titre, un numéro de page, une position et une taille dans la grille, puis les paramètres propres à son type. Le nom d'un tableau ou d'un graphique est le titre du bloc, enregistré dans le widget et non dans la table Grist.

Le modèle est validé à chaque lecture par un module de validation : types, bornes, couleurs hexadécimales, identifiants de colonnes sous forme de texte. Un modèle invalide ou d'une version plus récente est refusé avec un message clair et le widget ne l'écrase pas. Une migration versionnée est prévue dès la première version. Une alerte s'affiche si le modèle dépasse 200 Ko. Un bouton d'export et d'import du modèle en fichier JSON permet de le sauvegarder et de le partager entre documents ; l'import passe par la même validation.

7. Données : schéma, chemins, filtres, agrégats

Schéma. À partir de _grist_Tables et _grist_Tables_column, construire pour chaque table la liste de ses colonnes (identifiant, libellé, type) et un graphe des références (colonnes Ref et RefList). Les colonnes de type Ref portent des identifiants de lignes : pour afficher un libellé, il faut la colonne visible de la table cible (visibleCol). Les tables descendantes de la table liée sont celles qui atteignent la table liée par un chemin de une à trois références. Si plusieurs chemins existent, l'interface les propose avec un chemin recommandé et laisse choisir.

Chemins de colonnes. Une colonne peut être désignée par un chemin pointé qui traverse des références (par exemple la colonne d'une table atteinte par la référence d'un local). Le module résout ces chemins avec des index construits une seule fois.

Filtres. Un filtre compare un chemin de colonne à une valeur avec les opérateurs égal, différent, supérieur, inférieur, compris dans une liste, contient, est vide, est vrai. La valeur peut être une constante, le champ d'un enregistrement sélectionné ou l'identifiant de l'enregistrement sélectionné. Les filtres se combinent avec ET (et un groupe OU simple en version ultérieure).

Agrégats. Somme, moyenne, minimum, maximum, nombre de lignes et nombre de valeurs distinctes. Regroupement sur un ou deux chemins de colonnes, avec regroupement des dates par année ou par mois, tri (par libellé, par valeur ou par ordre imposé), N premiers avec ligne « Autres », libellés remplacés (par exemple une valeur brute affichée sous un libellé plus explicite). Tableau croisé : lignes, colonnes, mesure, découpage en tranches de N colonnes. Totaux par ligne et par colonne, sous-totaux par groupe.

Expressions. Les ratios et valeurs calculées s'écrivent avec un petit évaluateur écrit pour le widget : nombres, valeurs nommées entre accolades, les quatre opérations, les parenthèses et le moins unaire. Une division par zéro affiche un tiret. Aucun eval : un analyseur syntaxique propre, testé par des centaines de cas aléatoires.

Formats. Nombres au format français (espace insécable fine comme séparateur de milliers, virgule décimale), pourcentages avec espace avant le signe, dates au format jour mois année. Chaque colonne affichée a un nombre de décimales et une unité réglables.

Gestion des anomalies de données. Le widget ne corrige pas les données. Il affiche un avertissement discret quand un filtre exclut des lignes que le chemin avait retenues (par exemple des locaux dont le site ne correspond pas) avec le nombre de lignes et quelques exemples. Cela évite de recréer le problème de cohérence rencontré avec dashboard-batiment.

8. Canevas, pages et blocs

La page est une zone fixe en millimètres : A3 (297 x 420), A4 (210 x 297), A5 (148 x 210) en portrait ou en paysage, carré (210 x 210 par défaut) et un format écran (rapport 16 sur 9, 297 x 167 par défaut). La grille a un pas de 5 mm et des marges de 10 mm par défaut. À l'écran, le canevas est mis à l'échelle de la largeur du panneau avec un bouton d'ajustement et un zoom ; à l'impression, il est à l'échelle réelle.

Ajouter un bloc (bouton plus) crée un bloc du type choisi à la première place libre en lisant la page de haut en bas, de gauche à droite. S'il n'y a pas de place, une page est ajoutée à la suite. Une page vide à la fin disparaît d'elle-même. Les blocs ne se superposent jamais : un déplacement ou un redimensionnement qui créerait un recouvrement est ramené à la position valide la plus proche. Redimensionner avec la touche Maj enfoncée conserve les proportions. Un clic sélectionne un bloc et fait apparaître un crayon en haut à droite ; un double clic ouvre directement les paramètres ; la touche Suppr supprime le bloc après confirmation ; les flèches du clavier déplacent le bloc d'un pas de grille. Tout est faisable au clavier et au pointeur.

Tableaux longs. Un bloc de type tableau peut être réglé sur « continuer sur les pages suivantes ». Le moteur calcule la hauteur réelle du tableau : si elle dépasse la hauteur disponible, le reste des lignes passe en haut de la page suivante avec les intitulés répétés, sur la même largeur et à la même abscisse. Les blocs placés sous un tableau fluide sont repoussés d'autant. La ligne de total ne se répète pas à chaque page : elle n'apparaît qu'à la fin. Les tableaux à hauteur fixe coupent leurs lignes en trop avec un avertissement visible.

9. Types de blocs

Texte. Un éditeur Markdown simple et un rendu sûr. Le Markdown géré est limité à ce qui est demandé : titres de niveaux 1 à 4, gras, italique, gras italique, listes à puces et numérotées, liens https, paragraphes et sauts de ligne. Le rendu est écrit pour le widget et produit directement des nœuds DOM avec createElement et textContent, de sorte qu'aucun HTML n'est jamais interprété (pas de bibliothèque d'assainissement nécessaire). Le texte peut venir de deux sources : un texte fixe enregistré dans le widget, ou une colonne de la ligne sélectionnée. Dans le second cas, la saisie est écrite dans la cellule choisie (écriture différée d'environ une seconde, indication visible « enregistré », avertissement si la cellule a changé ailleurs pendant la saisie). Le texte peut contenir des champs {Colonne} ou {valeur nommée} remplacés par la valeur courante avec un format optionnel, ce qui permet des titres dynamiques.

Tableau. Quatre modes. Liste : une ligne par enregistrement, avec les colonnes choisies, les chemins pointés et les libellés de colonnes personnalisables. Regroupé : un regroupement et plusieurs mesures. Croisé : lignes, colonnes, mesure et découpage en tranches. Fiche : une seule ligne horizontale pour l'enregistrement sélectionné (la bande d'identité). Options communes : filtres, tri, ligne de total en bas séparée par une barre plus épaisse avec une fonction choisie dans la marge (somme par défaut, maximum, minimum, moyenne, nombre), colonne de total à droite avec les mêmes fonctions calculées par ligne, sous-totaux par groupe, résultats en gras, décimales, alignement. Libellés composés de plusieurs colonnes avec un modèle de texte (par exemple numéro, appellation, nom).

Graphique. Types demandés : histogramme groupé, courbe, barres empilées horizontales, histogramme empilé, barres empilées, aire empilée, secteur (camembert), anneau, nuage de points, compartimentage. Les variantes en trois dimensions sont traitées à part (partie 16). Configuration minimale : une colonne de catégories, une colonne de valeurs, une agrégation et un type ; tout le reste a une valeur par défaut raisonnable. Options avancées : deuxième dimension pour les séries, empilement en valeur ou en pourcentage, filtres, tri, N premiers, titre, légende (position), étiquettes de valeurs ou de pourcentages, titres d'axes, format des nombres. Quatre palettes prédéfinies de dix couleurs, dont la première reprend les teintes franches des documents de référence ; chaque palette est vérifiée pour le contraste et la distinction des couleurs. Les graphiques sont dessinés en SVG pour rester nets à l'impression et dans le PDF.

Image. Une image plate (PNG, JPEG, GIF, WebP, SVG, BMP, AVIF) prise dans une colonne de pièces jointes ou de liens de la ligne sélectionnée. S'il y a plusieurs images dans la cellule, un réglage donne le rang (première, deuxième...) avec le même ordre pour toutes les lignes. Réutiliser les modules images.js et drives.js du widget image_plus (même auteur, licence MIT) avec les mêmes règles : https seulement, liens Nextcloud, Google Drive et kDrive convertis, plafond de taille, message clair en cas d'échec. Ajustement contenu ou rempli, légende facultative. À l'impression, la fenêtre attend que toutes les images soient chargées.

Indicateur (retenu par Olivier). Une carte avec un libellé, une valeur en gras (agrégat, champ de la ligne sélectionnée ou expression de valeurs nommées), une unité et des règles de couleur par seuils (par exemple vert si la valeur dépasse un seuil, rouge sinon). Les valeurs nommées sont définies une fois dans le tableau de bord et réutilisables dans les indicateurs, les textes et les tableaux.

10. Interface d'édition

Un mode édition et un mode lecture. En édition : une barre d'outils (ajout de bloc, format de page, zoom, export et import du modèle, actualiser les données, imprimer) et le canevas. Le panneau de paramètres d'un bloc s'ouvre sur le côté en largeur normale et en feuille en bas quand le panneau Grist est étroit (environ 340 pixels). Les listes de tables et de colonnes viennent du schéma ; les colonnes sont présentées avec leur libellé et leur type. Toutes les erreurs sont affichées avec un message actionnable : quelle colonne vérifier et quelques exemples de lignes, jamais un simple compte. Les couleurs sont explicites sur chaque élément et le widget reste lisible en mode sombre et à 340 pixels de large. Pas de bouton plein écran dans le widget : Grist en fournit déjà un.

11. Impression et PDF

Le bouton Imprimer ouvre une fenêtre dédiée depuis un clic (comme la fenêtre flottante de image_plus, qui fonctionne dans le cadre de Grist). Cette fenêtre est une page du site qui reçoit le modèle et les résultats déjà calculés par postMessage, avec vérification de l'origine et de l'émetteur. Elle dessine toutes les pages à l'échelle réelle, attend que les graphiques, les polices et les images soient prêts, puis appelle l'impression du navigateur, qui permet aussi d'enregistrer en PDF. Les tailles de page sont des pages nommées déclarées en CSS statique (A3, A4, A5, carré, écran en portrait et paysage), ce qui évite tout style généré en ligne. Les sauts de page sont forcés entre les pages du tableau de bord. Les tableaux fluides répètent leurs intitulés. Un test Playwright produit le PDF et vérifie le nombre de pages.

12. Sécurité (à prévoir dès la conception)

Niveau d'accès : accès complet au document, indispensable pour lire les tables liées et écrire un texte. Ce choix est justifié dans le README. Écritures : une seule, la cellule choisie pour un bloc texte, dans la ligne sélectionnée, après vérification que la colonne existe et est de type texte. Les options enregistrées ne contiennent aucun secret. Aucun eval, aucun new Function, aucun HTML construit à partir de données : tout passe par createElement et textContent. Les styles de position se posent par l'objet style du DOM, ce que la politique de sécurité autorise, et non par des attributs de style dans du HTML. Politique de sécurité du contenu stricte : scripts du site et de l'API Grist seulement, connect-src limité à rien ou à blob: (les pièces jointes passent par des balises image), images en https et blob:. Le widget n'envoie aucune donnée à un service tiers et ne charge aucune tuile de carte. Les liens sont en https sans identifiants. Le modèle importé est validé. Les bibliothèques copiées (graphiques) sont vérifiées pour eval, new Function, styles en ligne et appels réseau, et ces vérifications sont notées dans VENDOR.md. Messages entre fenêtres : origine et émetteur vérifiés des deux côtés, contenu borné et nettoyé.

13. Performance (à prévoir dès la conception)

Mesurer avant d'optimiser, mais choisir d'emblée les bonnes structures. Les tables sont gardées en colonnes. Chaque table nécessaire est chargée une seule fois, avec un indicateur de chargement, puis réutilisée ; un bouton Actualiser relance le chargement (l'API ne prévient pas des changements dans les tables autres que la table liée). Les index de références sont construits une fois par table. Les agrégats se calculent en un seul passage avec des Map. Les résultats sont mémorisés avec une clé composée du modèle du bloc, de la version des données et de la ligne sélectionnée. Les modifications du modèle sont groupées avant l'enregistrement. En édition, seules les pages visibles sont dessinées ; à l'impression, toutes. Les graphiques ont les animations coupées. Prévoir un budget : un tableau de bord de dix blocs sur des tables de cent mille lignes doit se recalculer en moins d'une seconde au changement de ligne. fetchTable renvoie toutes les colonnes d'une table : le noter dans le README comme une limite connue.

14. Plan par versions (une version à la fois, testée par Olivier dans Grist)

Version 0.1, explorateur. Un widget minimal qui prouve les hypothèses sur l'API Grist : il affiche la table liée, la ligne sélectionnée, la liste des tables avec leurs colonnes, types et références, les tables descendantes, et le format exact des valeurs (listes de références, dates, pièces jointes). Il teste aussi la lecture d'un jeton de pièce jointe et l'écriture dans une cellule de test. Olivier le lance dans son document et colle le résultat. Rien d'autre n'est écrit avant que ces points soient confirmés.

Version 0.2, moteur de données. Modules purs et tests : schéma, chemins, filtres, agrégats, regroupements, croisés, expressions, formats ; jeu de données inventé avec des cas piégés (références cassées, valeurs vides, doublons, incohérences volontaires) ; affichage brut des résultats.

Version 0.3, canevas. Pages, formats, grille, ajout, déplacement, redimensionnement, suppression, collisions, nouvelles pages, enregistrement et validation du modèle, blocs vides avec titre. Modes édition et lecture.

Version 0.4, bloc texte. Rendu Markdown sûr, deux sources, champs dynamiques, écriture dans la cellule.

Version 0.5, bloc tableau. Modes liste, regroupé, croisé et fiche, filtres, tris, totaux, sous-totaux, libellés composés, tableaux fluides.

Version 0.6, indicateurs et valeurs nommées, si confirmés.

Version 0.7, bloc graphique en deux dimensions, quatre palettes.

Version 0.8, bloc image.

Version 0.9, impression et PDF dans la fenêtre dédiée, pagination.

Version 0.10, export et import du modèle, aide intégrée, textes français et anglais, README complet.

Version 0.11, recette : reproduire des fiches de référence, avec Olivier, pas à pas, à partir de ses tables réelles (la description de la recette reste privée).

Ensuite : finalisation avec audit de sécurité et de performance, nettoyage du code, commentaires, README final, puis variantes en trois dimensions si elles sont retenues et présentation à la communauté.

15. Tests

Tests unitaires Node pour chaque module pur, dont des tests aléatoires massifs pour l'évaluateur d'expressions, le moteur de collisions, les agrégats (comparés à un calcul naïf) et la validation du modèle. Tests d'intégration Playwright avec un faux objet grist et le jeu de données inventé : ajout et déplacement de blocs, nouvelle page, redimensionnement avec Maj, édition de texte et écriture, tableau avec totaux, graphique, image, changement de ligne, mode sombre à 340 pixels, impression avec nombre de pages. Les tests d'intégration ne sont pas dans le contrôle automatique de GitHub : on les lance avant chaque version.

16. Décisions prises par Olivier et valeurs par défaut

Décisions confirmées. Bibliothèque de graphiques : une version personnalisée d'Apache ECharts (licence Apache 2.0, rendu SVG, compartimentage, secteurs, nuages de points, aires empilées), copiée dans le dépôt. Les graphiques en trois dimensions sont reportés après la recette : ils demandent soit un module WebGL supplémentaire, soit un moteur SVG écrit à la main.

Indicateurs et valeurs nommées (confirmé) : ajouter le cinquième type Indicateur et les valeurs nommées dès la version 0.6, car la recette en dépend.

Tableaux longs (confirmé) : tableaux fluides qui continuent sur les pages suivantes.

Texte (confirmé) : les deux sources au choix, texte fixe dans le widget ou colonne de la ligne sélectionnée.

Valeurs par défaut à confirmer plus tard. Taille écran : rapport 16 sur 9 ; carré : 210 x 210 mm.

Lien avec Grist : le widget est lié à une table avec Sélectionner par ; un sélecteur de ligne interne pourra être ajouté plus tard.

Nom du dépôt : export_tdb, déjà créé.


Constats de la version 0.1 (explorateur, relevés sur un vrai document)

L'API fonctionne comme prévu : la table liée se lit avec grist.selectedTable, les tables de métadonnées _grist_Tables et _grist_Tables_column se lisent avec fetchTable et l'accès complet. Une table d'environ cinq mille lignes et cinquante colonnes se charge en un demi-seconde ; treize tables en moins de deux secondes. Cela confirme le choix de charger chaque table une fois et de la garder.

Formes des valeurs. Une référence est un nombre (le numéro de ligne, 0 quand elle est vide). Une liste de références, une liste de choix et une liste de pièces jointes sont des tableaux dont le premier élément est le code L. Une date est un nombre de secondes depuis 1970. Les colonnes de type Any peuvent contenir des valeurs encodées : liste L, objet O, date d, date et heure D, référence R, liste de références r, erreur E, valeur en attente P, valeur masquée C, valeur non lisible U, élément ignoré S. Un nombre entier et un nombre décimal ne se distinguent pas. Un nombre vide est null et 0 est une vraie valeur ; une référence vide est 0.

Structure. Un document réel a plusieurs dizaines de tables, dont des tables de synthèse (créées par Grist) qui apparaissent comme descendantes parce qu'elles contiennent une colonne de références vers la table liée ou une liste de lignes. Une table peut atteindre la table liée par plusieurs chemins (une référence directe et une chaîne passant par une autre table) ; ces chemins ne donnent pas toujours les mêmes lignes quand les données sont incohérentes. Deux lignes différentes peuvent porter le même libellé : les regroupements se font donc sur le numéro de ligne et non sur le texte. Les tables de synthèse et les chemins qui passent par une liste sont signalés à l'utilisateur et ne sont pas proposés en premier.

Restent à vérifier avec le propriétaire du document : le jeton d'une pièce jointe, l'écriture dans une cellule avec les deux méthodes et le changement de ligne (tests prévus dans l'explorateur).
