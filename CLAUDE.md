# Neguentropie_Framework

Site Observable Framework publié sur GitHub Pages, sous le sous-domaine (choix d'Erwan, 2026-11-19) :
https://framework.neguentropie.art/

- Domaine personnalisé GitHub Pages : `CNAME framework → pixflowave.github.io` dans le DNS IONOS de neguentropie.art ; domaine vérifié dans les réglages du compte GitHub ; « Custom domain » + « Enforce HTTPS » dans Settings → Pages du dépôt. L'ancienne adresse https://pixflowave.github.io/Neguentropie_Framework/ redirige vers le sous-domaine.
- `neguentropie.art` (domaine nu) reste la publication do•doc sur le VPS ; `tekhne.` et `do.doc.` sont d'autres sous-domaines, indépendants.

- Le déploiement se fait par GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) à chaque push sur `main` (environ 4 min). Plus de build quotidien depuis le 2026-11-17.
  - Un push qui ne touche que des fichiers `CLAUDE.md` (racine ou sous-dossiers, `**/CLAUDE.md`) ou `scripts/` ne déclenche pas de déploiement (`paths-ignore`, 2026-11-19). Les scripts écrivent dans `src/data/`, qui, lui, déploie.
  - Pour limiter les déploiements (souhait d'Erwan, 2026-11-19) : commiter en local au fil de l'eau et ne pousser qu'une fois le lot terminé.
- `npm run dev` : aperçu local · `npm run build` : génère `dist/`.
- Répondre en français. Ne faire de commit ou de push qu'avec l'accord d'Erwan.
- **Police** : Raleway sur tout le site, hébergée dans le dépôt depuis le 2026-11-19 (plus aucun appel à Google Fonts).
  - Fichiers sources : [polices/](polices/) (jeu latin, droit et italique, variable 100-900, paquet `@fontsource-variable/raleway` 5.1.1, licence OFL dans `polices/OFL.txt`).
  - `npm run police` ([scripts/generer-police.mjs](scripts/generer-police.mjs)) les intègre en base64 dans [src/raleway.css](src/raleway.css) et dans la vue 3D, entre les marqueurs `raleway:debut` et `raleway:fin`. Ce passage par le base64 est nécessaire, car Framework (esbuild) ne sait pas copier un fichier `.woff2` référencé dans le CSS.
  - [src/style.css](src/style.css) (option `style` de la config) importe `raleway.css` et remplace `--serif` et `--sans-serif`. Pas de `lining-nums` : on laisse les chiffres de Raleway comme sur pixflowave.fr.
  - **Typographie de pixflowave.fr** (2026-11-19, Erwan trouvait les titres trop gros) : texte 15 px, interligne 1,65 ; titres en graisse 600, h1 26 px, h2 20 px, h3 17 px, h4 à h6 15 px.
  - Le grand titre `.hero h1` (accueil, Symposium, convertisseur) suit le nom du site Pixflowave : 36 px, graisse 300, lettres espacées de 0,15 em, en or. Le style `.hero` n'est plus défini que dans `style.css`.
  - `globalStylesheets: []` empêche Framework de charger Source Serif 4 chez Google.
  - Les caractères hors du jeu latin (« ł » polonais, par exemple) s'affichent dans la police du système.
- **Favicon** (2026-11-19) : icosaèdre vu par un sommet, avec le dégradé violet → rouge → or des arbres de l'accueil. [src/favicon.svg](src/favicon.svg), plus [src/favicon.png](src/favicon.png) en 32 px pour les navigateurs qui ne lisent pas le SVG (rendu avec Chrome sans fenêtre).
- **`head` commun, description et Open Graph** (2026-11-19) : dans [observablehq.config.js](observablehq.config.js), `head` est une fonction `({title, path})` qui écrit le script `lang`, le favicon, `meta description` et les balises `og:` / `twitter:`. Les descriptions sont dans l'objet `DESCRIPTIONS`, indexé par adresse (`/index`, `/rencontres`…), car Framework 1.13 ignore les champs inconnus de l'en-tête des pages : ajouter une ligne pour toute nouvelle page. Ne jamais mettre `head:` dans l'en-tête d'une page, il remplacerait tout le `head` commun. L'image de partage est `src/Neguentropie.png`, lue sur raw.githubusercontent.com (adresse fixe, sans empreinte) : elle n'est donc à jour qu'après le push.
- **Couleurs : palette de pixflowave.fr** (2026-11-19, demande d'Erwan) : un seul thème sombre, quel que soit le réglage de l'ordinateur. Elle est définie dans [src/style.css](src/style.css) : thème `near-midnight` de Framework, dont les variables sont remplacées.
  - Fond `#565656` (`--theme-background-a`), surfaces `#4d4d4d` (`-b` : barre latérale, cartes).
  - Texte et titres `#fff8e7`, liens et accents or `#ffc536` (`--theme-foreground-focus`).
  - Texte secondaire `#ffe29b` (`-muted`), traits `#7a7a7a` (`-faintest`).
  - Liens soulignés fin et décollés ; les ancres de titre, la barre latérale, la table des matières et les liens-boutons ne sont pas soulignés.
  - Sur un fond or, écrire le texte en `var(--theme-background)`, jamais en blanc.
  - La vue 3D utilise la même palette (`--bg`, `--fg`, `accent-color`).
  - Référence : `src/styles/global.css` du dépôt pixflowave-fr.
- **Graphiques de l'accueil : Framework est la source** (2026-11-19, choix d'Erwan). Les notebooks `@pixflowave/graph_neguentropie` et `@pixflowave/airocean-attracteur-de-lorenz` sont portés dans [src/graphiques/](src/graphiques/). On modifie désormais le code ici, pas sur Observable. Les notebooks restent en ligne, et un lien « Notebook sur ObservableHQ ↗ » y renvoie ([src/components/cadre.js](src/components/cadre.js)).
  - [src/graphiques/graphe.js](src/graphiques/graphe.js) : graphe réticulé (recherche, zoom, glisser). La disposition est calculée au build par le chargeur [src/data/graphe-neguentropie.json.js](src/data/graphe-neguentropie.json.js). Glisser un nœud relance la simulation.
    - **Forces** : celles du notebook (lien 350, force 1,5, répulsion −max(enfants × parents², 400)), dans [src/graphiques/forces.js](src/graphiques/forces.js), partagé par le chargeur et le graphe. Un essai plus compact (2026-11-20) a été abandonné : les arcs courts manquaient d'élégance (Erwan). Après modification de `forces.js`, vider le cache local (voir plus bas).
    - **Noms selon le zoom** (2026-11-20, Erwan aime beaucoup ce jeu d'apparition et de disparition) : étiquettes à 11 px constants à l'écran ; de loin, seuls les nœuds très reliés sont nommés (fonction `seuil`), les autres apparaissent en zoomant ; titres abrégés à 34 caractères ; aucune étiquette n'en chevauche une autre (`placerEtiquettes`, par ordre d'importance) ; le type des liens apparaît de près (`ECHELLE_TYPES`), au sommet de l'arc, seulement pour les liens dont les deux nœuds sont dans le cadre.
    - **Police** (2026-11-20) : Raleway nommée explicitement (`POLICE`), y compris pour le champ de recherche (un champ de formulaire n'hérite pas de la police de la page) et pour les sites qui importent le module. Graisse 300 (`GRAISSE`, 600 pour le résultat de recherche courant), liseré couleur du fond de 1 px (`LISERE`, 3 à l'origine, puis 2) : lettres plus déliées, à la demande d'Erwan. En contrepartie, les arcs se voient un peu plus à travers les noms : remonter `LISERE` si besoin.
    - **Essayés puis retirés à la demande d'Erwan** (2026-11-20) : survol qui allume les voisins et estompe le reste (le schéma clignotait, très désagréable) ; vue d'ensemble à l'ouverture et bouton « Vue d'ensemble » (« on perd la poésie d'une constellation d'étoiles, pas besoin de voir le graphe en entier dès le départ ») ; arcs aplatis. L'ouverture reste la vue du notebook, centrée, et les grands arcs (rayon = longueur du lien) sont gardés.
    - Recherche (2026-11-20) : insensible à la casse, aux accents, aux lettres spéciales (« michal » trouve « Michał ») et à la ponctuation, par mots dans n'importe quel ordre ; si aucun nœud n'a tous les mots, ceux qui en ont le plus. Classement : nom exact, nom qui commence par la recherche, mots en début de mot, puis les nœuds les plus reliés. Suggestions pendant la frappe ; Entrée ou clic pour zoomer, ↑ ↓ pour passer d'un résultat à l'autre, Échap pour effacer.
    - Zoom : le SVG a `style` width/height à 100 %. Sans ce style, la feuille de Framework (`height: auto`) le rendait carré : il débordait du cadre de 600 px et le nœud cherché tombait 166 px sous le centre.
  - Données du graphe : [src/data/neguentropie_Graph.json](src/data/neguentropie_Graph.json), seule source depuis le 2026-11-19. Elle a été reprise du dépôt Pixflowave/Neguentropie (451 nœuds, mars 2026), que le notebook lisait. Le convertisseur bibliographique lit le même fichier.
    - Nettoyé le 2026-11-20 (452 nœuds, 681 arêtes, 0 arête pendante ni doublon) par [scripts/nettoyer-graphe.mjs](scripts/nettoyer-graphe.mjs), qui contient la liste des décisions d'Erwan et peut être relancé sans effet. `npm run diagnostic:graphe` ([scripts/diagnostic-graphe.mjs](scripts/diagnostic-graphe.mjs)) liste ce qui cloche, sans rien modifier.
    - **Piège du cache** : Framework ne relance le chargeur `graphe-neguentropie.json.js` que si le chargeur lui-même change, pas quand `neguentropie_Graph.json` est modifié. En local, supprimer `src/.observablehq/cache/data/graphe-neguentropie.json` avant `npm run build` ou `npm run dev`. Le déploiement GitHub n'est pas concerné (pas de cache Framework en CI).
  - [src/graphiques/lorenz.js](src/graphiques/lorenz.js) : attracteur de Lorenz (Runge-Kutta 4, réglages du notebook dans `REGLAGES`) sur la carte Airocean découpée en 500 triangles. Ils apparaissent un par un toutes les 20 ms, comme dans le notebook.
    - La découpe est précalculée par `npm run airocean` ([scripts/generer-airocean.mjs](scripts/generer-airocean.mjs)) dans [src/data/airocean-triangles.json](src/data/airocean-triangles.json) (100 Ko, environ 4 min de calcul).
    - Le script utilise d3-geo-polygon 2.0.1, d3-geo-projection 4.0.0, polybooljs 1.2.2 et visionscarto-world-atlas 0.0.6 (110m), en dépendances de développement.
    - Ne le relancer que si la projection, la subdivision ou la carte changent.
  - **Modules exportés** (`dynamicPaths` dans la config) : `https://framework.neguentropie.art/graphiques/graphe.js` et `…/lorenz.js`. Chacun exporte une fonction asynchrone (`graphe({hauteur})`, `lorenz(options)`) qui renvoie un élément à insérer.
    - `FileAttachment` y résout les fichiers par rapport à `import.meta.url` : ils fonctionnent importés depuis un autre site. GitHub Pages répond avec `access-control-allow-origin: *`.
    - pixflowave.fr est fait pour les importer à la place d'api.observablehq.com.
    - Les données du graphe ne changent en ligne qu'après un push.
  - L'ancien `components/notebook.js` (runtime Observable 5.9.9 depuis jsDelivr) a été supprimé. `npm:@observablehq/runtime` ne convient pas : Framework le remplace par son runtime interne, sans `Library`.
- **Pol.is (page Symposium)** : pas de thème sombre, et son iframe ne peut pas être stylée depuis le site. Le module est encadré (`.polis-cadre` dans `style.css` : liseré or, coins arrondis) ; la bordure de Pol.is est retirée avec `data-border='none'`, `data-border_radius='0'` et `data-padding='0'`. La conversation a un champ `bgcolor` (vide), mais l'interface d'administration ne le propose plus : l'onglet Configure n'a aucun réglage de couleur (vérifié par Erwan le 2026-11-19). En capture Chrome sans fenêtre, l'iframe ne se charge pas : vérifier dans un vrai navigateur.
  - Conversation en ligne depuis le 2026-11-19 : `7ekm9ctpnd`, « Symposium néguanthropique : quelles bifurcations ? ». Elle a été créée depuis l'administration, sans `parent_url`.
    - Réglages : modération stricte, visualisation, commentaires, aide et abonnement activés, Invite Tree désactivé.
    - Rapport public : https://pol.is/report/r8zpskjtn8jnjajeevbny (lien sous le module).
    - Les 20 affirmations de départ ont été proposées à Erwan dans un fichier CSV (`comment_text`), à importer avec « Upload a CSV of seed comments ».
    - Elle remplace `2f5mfrhdp4` (« Premier cheminement »), qui ne contenait que des votes de test et avait une adresse « Embedded on » morte.
  - `data-parent_url` donne l'adresse définitive de la page Symposium (sinon, Pol.is reçoit l'adresse courante, y compris `localhost` en aperçu). Le champ « Embedded on » de l'onglet Distribute contenait encore l'ancienne adresse `pixflowave.observablehq.cloud/techne/exemple%20index` (403). C'est elle qui sert aux e-mails de suivi. Pol.is ne la modifie jamais : `parent_url` est fixé à la création de la conversation, et ni l'interface ni l'API (`PUT /api/v3/conversations`) ne le changent (code source vérifié le 2026-11-19). L'API accepte en revanche `bgcolor`, `help_color`, `help_bgcolor` et `style_btn`, que l'interface ne montre plus. Ça ne sert à rien : la page de participation force le fond blanc (`ctx.polis_bgcolor = "white"`, la lecture de `bgcolor` est en commentaire dans `client-participation/js/views/participation.js`), et `client-participation-alpha` ne lit pas ce champ. Seul un filtre CSS `invert` sur l'iframe donnerait un fond sombre, au prix de couleurs faussées : écarté.
- **Largeur du texte** : Framework limite volontairement les paragraphes et les titres à 640 px. C'est normal, ce n'est pas un bug.

## Page « Enveloppe icosaédrique 3D »

[src/enveloppe-icosaedrique-3d.md](src/enveloppe-icosaedrique-3d.md) contient trois parties :
- deux colonnes de texte (grille `grid grid-cols-2`) sous le titre : « La carte Airocean sur l'enveloppe » et « Le logo du Fediverse sous la nacelle ». Le texte a été validé par Erwan. Ne pas y ajouter de rapprochement avec Tiers-Lieux Édu : leur logo est un hexagone, pas le logo du Fediverse, et Erwan a écarté l'idée ;
- la vue 3D, intégrée en iframe ;
- la carte Leaflet des sites de vol autour de Cossonay.

### Vue 3D de la montgolfière : [src/enveloppe-3d-viewer.html](src/enveloppe-3d-viewer.html)

C'est un fichier HTML autonome qui utilise three.js r128 (cdnjs) et OrbitControls r128 (jsDelivr). Les lignes 65-66 (`TEXB`, `PHOTB`) contiennent les textures de carte en base64 (environ 1,8 Mo) : ne jamais les lire ni les afficher en entier. Pour chercher dans le fichier, couper les lignes longues, par exemple avec `awk 'length($0)<3000'`.

- **Textures de carte** : `TEXB` (3 PNG de 2304 × 1152 : océan bleu clair, terres beiges) sert de source au style « Dorée », et `PHOTB` (3 JPEG de 2304 × 1152) au style « Photo NASA ».
- **Style « Dorée »** (par défaut depuis le 2026-11-19 ; il remplace le style « Vecteur », retiré à la demande d'Erwan) : la fonction `dorer` recolorie `TEXB` dans le navigateur, au chargement, avec la palette du site : océan `OC` `#333333` à 55 % d'opacité (`AO`), terres `TE` `#ffc536` à 70 % (`AT`), côtes `CO` `#fff8e7` et quadrillage `QU` `#7a7a7a` opaques. Opacité générale du matériau : 0,92. Chaque pixel est décomposé en part de terre (teinte chaude, r − b) et part de trait (plus sombre que le fond), ce qui garde l'anticrénelage. Aucune image ajoutée au fichier. Choix d'Erwan : océan sombre et transparent, pour voir le volume de l'enveloppe à travers.
- **Style « Fediverse »** (2026-11-19) : même recoloriage (`dorer(b64, fediTerre)`), mais les terres suivent un dégradé circulaire par les 5 couleurs des nœuds du logo (`FEDI.noeud` : jaune, vert, bleu, violet, rouge), une couleur au centre de chaque colonne du patron (période 209,09 unités sur 1152). Calculé seulement au premier choix (`fediTexs`). Les couleurs sont alignées sur les nœuds de la nacelle, dans les 3 orientations (vérifié par le calcul le 2026-11-19) : le nœud `j` est à l'azimut 36° + 72°·j (`cornerF`), et la colonne `i` du patron couvre 72°·i à 72°·(i+1), avec azimut = 72° × (u − 1) / 209,09 ; son centre (u = 105,545 + 209,09·i) tombe donc au-dessus du nœud `i`. Même repère (`pol`, `cornerF`, miroir `root.scale.x = -1` commun), et le plaquage `NU` ne change pas avec l'orientation. Variable `sty` : 0 Dorée, 1 Photo NASA, 2 Fediverse. Il y a une image par orientation de la carte Airocean (les 3 choix de découpe). Chacune est déjà dépliée en patron d'icosaèdre, et three.js la plaque telle quelle sur l'enveloppe. Ajoutées le 2026-10-12 (commit `d0ce1e1`).
- **Source de la photo NASA** (`PHOTB`) : NASA Blue Marble Next Generation, janvier 2004, variante relief + bathymétrie (`world.topo.bathy.200401`).
  - Page NASA : https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/ (pages voisines : `base-map/` sans relief, `base-topography/` avec relief seul).
  - Fichier 5400 × 2700 : https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/january/world.topo.bathy.200401.3x5400x2700.jpg (vérifié le 2026-11-17).
  - Comment la variante a été identifiée : les océans de `PHOTB` montrent le plateau continental et les reliefs sous-marins, ce que n'ont ni `world.200401` ni `world.topo.200401` (océans uniformes). La résolution d'origine (5400 ou 21600 px) n'est pas connue.
  - Piste d'origine : le notebook « Equal Earth GLSL » de Philippe Rivière (https://observablehq.com/@fil/equal-earth-glsl) utilise `world.topo.200401.3x5400x2700.jpg` et le reprojette en GLSL grâce à la projection inverse. Ce n'est pas exactement la même variante que la nôtre.

- **Logo Fediverse sous la nacelle** (2026-11-17) : les câbles qui passent sous le plancher dessinent l'étoile, les patins cuir dessinent le pentagone, et une boule colorée marque chaque coin. Les couleurs sont dans l'objet `FEDI` (`bord`, `etoile`, `noeud`). Elles viennent de la version Wikimedia du logo et n'ont pas été comparées à celle de Mattermost.
- **Caméra** : OrbitControls permet de tourner dans tous les sens (y compris par-dessous), de zoomer à la molette ou au pincement, et de déplacer la vue au clic droit ou à deux doigts. Le double-clic recentre la vue. La rotation automatique s'arrête au premier geste. La lumière `sun` est attachée à la caméra.
- **Étiquettes** (tableau `LB`) :
  - Elles sont affichées par défaut depuis le 2026-11-17 (case « Étiquettes » cochée ; `showL` vaut `true` au départ). Elles étaient masquées avant que leur rangement soit au point.
  - Une fois affichées, elles se rangent en deux colonnes sur les bords du cadre et sont empilées sans chevauchement (fonction `stack`). Chacune est reliée à son point par un trait SVG (`#ld`).
  - Elles sont masquées quand la montgolfière occupe le cadre, c'est-à-dire quand il reste moins de 110 px de libre sur un côté. Elles ne réapparaissent qu'au-delà de 150 px, pour éviter le clignotement.
  - Sur téléphone, elles ne s'affichent donc presque jamais.
- **Téléphone** (2026-11-19) : sous 600 px de large, les réglages et l'aide sont repliés derrière le bouton « Réglages et aide » (`#reg`, classe `ouvert` sur `body`). Sinon, ils prenaient presque toute la hauteur et l'enveloppe ne se voyait plus. La fonction `cadrer` recule la caméra en portrait pour que l'enveloppe tienne en largeur (position d'origine `CAM0`), tant qu'on n'a pas touché à la vue ; le double-clic recentre avec ce cadrage. Le rendu suit la taille du cadre (`ResizeObserver`), à la densité de l'écran (plafonnée à 2×).
- **Bouton « Fermer le plein écran »** (`#fermer`) : visible seulement quand la vue est ouverte seule (lien « Ouvrir en plein écran »), pas dans l'iframe. Il ferme l'onglet, ou, si le navigateur refuse, revient à `../enveloppe-icosaedrique-3d` (la vue est publiée dans `/_file/`). Échap fait de même.
- **Vérifier le rendu sur téléphone** : Chrome sans fenêtre ne descend pas sous 500 px, mais une page qui contient la vue en iframe de 375 × 600 px fonctionne (ajouter `--allow-file-access-from-files`).
- **Vérifier le rendu sans navigateur** : prendre une capture avec Chrome sans fenêtre, par exemple `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --enable-unsafe-swiftshader --window-size=1400,900 --virtual-time-budget=6000 --screenshot=shot.png file:///chemin/vers/copie.html`. Ce mode ne sait pas descendre sous environ 500 px de large.

### Carte des sites de vol

- Fonds de carte : swisstopo par défaut (satellite affiché à l'ouverture, plan swissTLM3D, carte nationale, relief). « Plan (OpenStreetMap) » reste au choix, mais n'est jamais chargé d'office, pour ménager les serveurs OSM (depuis le 2026-11-17). Les fonds swisstopo ne couvrent que la Suisse et ses abords.
- Les sites sont choisis à la main dans [src/data/sites-manuels.json](src/data/sites-manuels.json).
- **Données OSM : GeoDesk, plus d'Overpass** (depuis le 2026-11-18). Bibliothèque locale `donnees-osm/romandie.gol` (≈ 740 Mo, 291 tuiles, ignorée par git), interrogée avec l'outil `gol` (binaire autonome, https://www.geodesk.com/download, version 2.5.3 testée ; variable `GOL` si `gol` n'est pas dans le PATH). Tout passe par [scripts/osm.mjs](scripts/osm.mjs).
  - `npm run osm` (re)charge la bibliothèque depuis le fichier planète GOB d'openplanetdata.com, sur la zone des sites choisis (+ 0,04°) et du cercle de 100 km des aérodromes (`5.198,45.72,7.817,47.52`) : seules les tuiles utiles arrivent, en quelques secondes. La zone chargée est notée dans `donnees-osm/zone.json`. Les scripts refusent de tourner si elle ne couvre plus la zone voulue (nouveau site hors zone).
  - Sous Claude Code, `npm run osm` doit tourner dans un terminal ordinaire : `gol` ignore le proxy du bac à sable. Les requêtes (`gol query`) n'utilisent pas le réseau.
  - Mise à jour annuelle : `npm run osm`, puis `npm run aerodromes`, `npm run reliefs` et `npm run terrains`.
- **Altitudes swisstopo précalculées** (depuis le 2026-11-18) : `npm run reliefs` écrit [src/data/reliefs.json](src/data/reliefs.json) (altitude et dénivelé à 300 m de chaque site, clé `lat,lon`), en ne mesurant que les sites qui manquent (`-- --tout` pour tout remesurer). [src/data/sites.json.js](src/data/sites.json.js) le lit : le build ne fait plus aucune requête réseau. Un site absent du fichier est mesuré au build et signalé dans le journal (« Reliefs manquants… ») : lancer `npm run reliefs` après chaque modification de `sites-manuels.json`. Code commun dans [scripts/relief.mjs](scripts/relief.mjs).
- Les aérodromes à code OACI dans 100 km autour de Cossonay sont précalculés par `npm run aerodromes` (sortie dans [src/data/aerodromes.json](src/data/aerodromes.json), qui remplace l'ancienne copie de secours `aerodromes-secours.json`). [src/data/sites.json.js](src/data/sites.json.js) les lit tels quels : le build n'interroge plus Overpass. Le 2026-11-18 : 38 aérodromes, identiques à ceux d'Overpass.
- Les terrains de 1 ha ou plus situés dans un rayon de 2 km sont précalculés par `npm run terrains` (sortie dans [src/data/terrains.json](src/data/terrains.json)), ou `npm run terrains -- "Nom"` pour un seul site. Le résultat est reproductible (tri par distance, puis surface, puis contour).
  - Les multipolygones sont pris en compte : `contour` vaut `[[lat, lon], …]` pour un polygone simple, `[extérieur, trou…]` pour un polygone à trous, `[[extérieur, trou…], …]` pour plusieurs parties. `L.polygon` accepte les trois formes telles quelles.
  - Le champ `osm` de `terrains.json` donne la date des données OSM.
- Aérodromes : pas de recherche de terrain. On y décolle avec l'accord du gestionnaire.
- Résultat du 2026-11-18 : 1 120 terrains (932 avec Overpass, qui ne prenait que les `way`) ; Gruyères en a 16 et Château de Chillon 7, contre 0 avant. Le fichier passe de 0,9 à 2,1 Mo, surtout à cause des grands pâturages en multipolygone (Sainte-Croix, Gstaad).

## Historique récent

| Date | Commit | Changement |
|---|---|---|
| 2026-11-19 | 5acc4ae | Cohérence du site : pied de page commun (Framework, Plot, D3, Leaflet, three.js, Raleway, Licence Art Libre), crédits harmonisés sur toutes les pages, liens do.doc remplacés par tekhne, accueil renvoyant vers Rencontres, coquilles, pages d'exemple supprimées |
| 2026-11-18 | 62668b9 | Terrains et aérodromes via GeoDesk au lieu d'Overpass, multipolygones pris en compte, altitudes précalculées : build sans réseau |
| 2026-11-18 | dfcb4ce | Texte Airocean : origine du nom (1954) et transformation de Gray |
| 2026-11-17 | 41e48c1 | Crédits Airocean, Natural Earth et NASA, attribution OSM permanente, étiquettes affichées par défaut |
| 2026-11-17 | 47b3f9a | Carte : fonds swisstopo par défaut, OpenStreetMap seulement sur demande |
| 2026-11-17 | bcf06b7 | Textes Airocean et Fediverse en deux colonnes, police Raleway |
| 2026-11-17 | dbcc66f | Ajout de CLAUDE.md |
| 2026-11-17 | 162425c | Vue 3D : logo Fediverse, caméra libre, étiquettes en colonnes |
| 2026-11-17 | 3f34de7 | Terrains précalculés autour des sites choisis |

## Accueil

- Les arbres des participants passent par [src/components/arbre.js](src/components/arbre.js) : `arbre(chemins, {height, marginTop, marginBottom})`, un identifiant de dégradé par arbre. La courbe garde un décalage vertical de 0,001 px : sans lui, le lien horizontal d'un arbre à nombre impair de personnes a une boîte de hauteur nulle et le dégradé ne se dessine pas. Ne pas la remplacer par `curve: "bump-x"`.

## Néguanthropocène

- Les 7 images de la page (schéma et photos) sont dans [src/images/neguanthropocene/](src/images/neguanthropocene/) depuis le 2026-11-19, réduites à 1 200 px de large. Elles étaient avant sur imgur.

## Respect des communs utilisés (relecture du 2026-11-17)

Déjà en place :
- Les tuiles OSM ne sont jamais chargées d'office (fond swisstopo par défaut).
- Altitudes swisstopo précalculées : plus de requêtes à geo.admin.ch au build.
- Terrains et aérodromes précalculés à partir d'une bibliothèque GeoDesk locale : plus aucune requête Overpass, ni au build ni à la main, et un seul téléchargement partiel (tuiles de la zone) par an chez openplanetdata.com.
- Attributions : swisstopo et geodienste.ch / OFAG sur leurs couches. La mention « © contributeurs OpenStreetMap » est affichée en permanence sur la carte (`attributionOsm`, ajoutée via `map.attributionControl`), car les aérodromes et les terrains viennent d'OSM.
- Ligne « Carte des sites » des crédits : OSM (ODbL) extrait avec GeoDesk des données openplanetdata.com, altitudes © swisstopo (ajout du 2026-11-18 ; GeoDesk, sous licence Apache 2.0, n'exige pas de mention, c'est une politesse).
- **Orthographe** : écrire « Artéfacts » dans les textes (choix d'Erwan, 2026-11-19) ; seules les adresses restent `artefacts.coop`.
- Logo Artéfacts centré (avec son lien) en bas des 6 pages du menu, avec le même bloc de licence : « sauf mention contraire », Licence Art Libre en https (harmonisé le 2026-11-19). Un bloc « Sources et crédits de cette page » existe sur toutes les pages sauf Néguanthropocène, qui a sa propre section Références.
- Pied de page commun (`footer` dans [observablehq.config.js](observablehq.config.js), depuis le 2026-11-19) : Observable Framework, Observable Plot, D3, Leaflet, three.js, Raleway et Licence Art Libre. Il remplace « Built with Observable ». Les notebooks ObservableHQ intégrés sur l'accueil sont crédités dans le bloc « Sources ».
- **Liens de documentation** (choix d'Erwan, 2026-11-19) : uniquement tekhne.neguentropie.art (dodoc, API `/_api2/spaces/neguentropie/projects` pour retrouver les adresses des publications). Plus de liens vers do.doc.neguentropie.art. La page « Documentation » est la section `section-1759686184677` de la publication Néguentropie, servie sur https://neguentropie.art/?section=section-1759686184677.meta.txt.
- **Accueil** : pas de doublon avec Rencontres. La vidéo Reboute et la liste des publications ne sont que sur [src/rencontres.md](src/rencontres.md) ; l'accueil y renvoie (choix d'Erwan, 2026-11-19).
- Bloc « Sources et crédits de cette page » en bas de [src/enveloppe-icosaedrique-3d.md](src/enveloppe-icosaedrique-3d.md), et ligne de crédit à la fin de `#hint` dans la vue 3D. Licence Art Libre « sauf mention contraire », lien en https.
- **Sources des textures de la vue 3D** (crédits ajoutés le 2026-11-17 en bas de page et sous la vue 3D) :
  - Carte vectorielle Airocean (`TEXB`, source du style « Dorée ») : créée par Philippe Rivière (son compte Observable s'appelle « Fil », d'où les adresses `@fil`), déjà crédité en bas de page (précision d'Erwan, 2026-11-17).
    - Notebooks de Philippe Rivière sur lesquels Erwan s'est appuyé : https://observablehq.com/@fil/airocean-projection · https://observablehq.com/@fil/a-conformal-airocean · https://observablehq.com/@fil/triangular-tiling-of-icosahedron
    - Contours des continents : les trois notebooks chargent `https://unpkg.com/visionscarto-world-atlas@0.0.6/world/110m_land.geojson` (version 0.0.4 pour « a-conformal-airocean »). Ce paquet de Philippe Rivière (licence BSD-3-Clause, https://github.com/Fil/visionscarto-world-atlas) reprend les données Natural Earth au 1:110 000 000, qui sont dans le domaine public. Il y ajoute quelques îles Kouriles.
    - Échelle vérifiée le 2026-11-17 : `TEXB` contient 102 taches de terre séparées (première image), contre 128 polygones dans `110m_land` et 1 427 dans `50m_land`. C'est donc le 110m : les plus petites îles font moins d'un pixel et disparaissent. Ce comptage ne permet pas de distinguer visionscarto-world-atlas du world-atlas de Mike Bostock, mais les deux viennent de Natural Earth, donc le crédit reste le même.
  - Photo NASA (`PHOTB`) : la source est connue (voir « Source de la photo NASA » plus haut). L'image est libre de droits, mais la NASA demande d'être citée et interdit d'utiliser son logo. Mention présente.
- **Nom de la carte** : ne parler que de « carte Airocean » (choix d'Erwan, 2026-11-17). « Dymaxion » et « Fuller Projection » sont des marques revendiquées par le Buckminster Fuller Institute : ne pas les employer dans les textes du site. Le nom de Buckminster Fuller, auteur de la carte, reste cité. « Airocean » est le nom donné par Fuller lui-même à la version de 1954 (« Airocean World Map ») ; la version de 1943 parue dans *Life* s'appelait « Dymaxion World ». La texture de la vue 3D suit l'orientation de Fuller et la transformation de Gray : elle est presque équivalente (surfaces conservées), pas conforme. La variante conforme du notebook « a-conformal-airocean » (sur le tétraèdre de Markley) est une autre carte. Exception : les titres de sources externes dans `src/data/neguentropie_Graph.json` restent tels quels.
- Langue : Framework 1.13 écrit `<html>` sans `lang`. Un petit script dans le `head` de [observablehq.config.js](observablehq.config.js) déclare `fr` au chargement.
- Carte Leaflet : `map.invalidateSize()` avant chaque `fitBounds` (elle s'était ouverte une fois au zoom 0). Les textes venant des données (`p.name`, `p.type`, `p.tourism`, `t.genre`) passent par `esc()` avant d'être insérés en HTML.

À corriger :
- Le convertisseur garde son propre style (émojis, dégradé violet/rouge codé en dur dans ses cartes et ses boutons).
- **Convertisseur bibliographique** : audit complet du 2026-11-19 dans [audit-convertisseur/CLAUDE.md](audit-convertisseur/CLAUDE.md), à lire avant toute modification du convertisseur ou de ses modules. Points critiques : la fusion peut corrompre le graphe (résultats incertains acceptés, titres tronqués, entrées écartées sans message).

## À faire / idées

- Comparer les couleurs du logo avec la version Mattermost si besoin.
- Si le plan OSM devient très utilisé : générer nos propres tuiles vectorielles (extrait Geofabrik ou Protomaps → un fichier PMTiles pour la région, affiché avec `protomaps-leaflet`). Interdit d'aspirer les tuiles de tile.openstreetmap.org dans le build.
- Tenir ce fichier à jour à chaque évolution notable.
