# Neguentropie_Framework

Site Observable Framework publié sur GitHub Pages :
https://pixflowave.github.io/Neguentropie_Framework/

- Le déploiement se fait par GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) à chaque push sur `main` (environ 4 min). Plus de build quotidien depuis le 2026-11-17.
- `npm run dev` : aperçu local · `npm run build` : génère `dist/`.
- Répondre en français. Ne faire de commit ou de push qu'avec l'accord d'Erwan.
- **Police** : Raleway sur tout le site, chargée depuis Google Fonts dans le `head` de [observablehq.config.js](observablehq.config.js). Elle remplace `--serif` et `--sans-serif`, avec des chiffres alignés (`font-variant-numeric: lining-nums`). La vue 3D charge aussi Raleway de son côté.
- **Largeur du texte** : Framework limite volontairement les paragraphes et les titres à 640 px. C'est normal, ce n'est pas un bug.

## Page « Enveloppe icosaédrique 3D »

[src/enveloppe-icosaedrique-3d.md](src/enveloppe-icosaedrique-3d.md) contient trois parties :
- deux colonnes de texte (grille `grid grid-cols-2`) sous le titre : « La carte Airocean sur l'enveloppe » et « Le logo du Fediverse sous la nacelle ». Le texte a été validé par Erwan. Ne pas y ajouter de rapprochement avec Tiers-Lieux Édu : leur logo est un hexagone, pas le logo du Fediverse, et Erwan a écarté l'idée ;
- la vue 3D, intégrée en iframe ;
- la carte Leaflet des sites de vol autour de Cossonay.

### Vue 3D de la montgolfière : [src/enveloppe-3d-viewer.html](src/enveloppe-3d-viewer.html)

C'est un fichier HTML autonome qui utilise three.js r128 (cdnjs) et OrbitControls r128 (jsDelivr). Les lignes 65-66 (`TEXB`, `PHOTB`) contiennent les textures de carte en base64 (environ 1,8 Mo) : ne jamais les lire ni les afficher en entier. Pour chercher dans le fichier, couper les lignes longues, par exemple avec `awk 'length($0)<3000'`.

- **Textures de carte** : `TEXB` (3 PNG de 2304 × 1152) sert au mode « Vecteur », et `PHOTB` (3 JPEG de 2304 × 1152) au mode « Photo NASA ». Il y a une image par orientation de la carte Airocean (les 3 choix de découpe). Chacune est déjà dépliée en patron d'icosaèdre, et three.js la plaque telle quelle sur l'enveloppe. Ajoutées le 2026-10-12 (commit `d0ce1e1`).
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
- **Vérifier le rendu sans navigateur** : prendre une capture avec Chrome sans fenêtre, par exemple `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --enable-unsafe-swiftshader --window-size=1400,900 --virtual-time-budget=6000 --screenshot=shot.png file:///chemin/vers/copie.html`. Ce mode ne sait pas descendre sous environ 500 px de large.

### Carte des sites de vol

- Fonds de carte : swisstopo par défaut (satellite affiché à l'ouverture, plan swissTLM3D, carte nationale, relief). « Plan (OpenStreetMap) » reste au choix, mais n'est jamais chargé d'office, pour ménager les serveurs OSM (depuis le 2026-11-17). Les fonds swisstopo ne couvrent que la Suisse et ses abords.
- Les sites sont choisis à la main dans [src/data/sites-manuels.json](src/data/sites-manuels.json).
- Les aérodromes viennent d'Overpass ([src/data/sites.json.js](src/data/sites.json.js)), avec une copie de secours dans `aerodromes-secours.json`. Overpass sature souvent : il ne doit jamais être indispensable au build.
- Les terrains de 1 ha ou plus situés dans un rayon de 2 km sont précalculés par `npm run terrains` (sortie dans [src/data/terrains.json](src/data/terrains.json)). Relancer environ une fois par an, ou `npm run terrains -- "Nom"` pour un seul site.
- Aérodromes : pas de recherche de terrain. On y décolle avec l'accord du gestionnaire.
- Limite connue : seuls les `way` sont pris en compte, pas les multipolygones, si bien que Gruyères et Château de Chillon n'ont aucun terrain.

## Historique récent

| Date | Commit | Changement |
|---|---|---|
| 2026-11-17 | bcf06b7 | Textes Airocean et Fediverse en deux colonnes, police Raleway |
| 2026-11-17 | dbcc66f | Ajout de CLAUDE.md |
| 2026-11-17 | 162425c | Vue 3D : logo Fediverse, caméra libre, étiquettes en colonnes |
| 2026-11-17 | 3f34de7 | Terrains précalculés autour des sites choisis |

## Respect des communs utilisés (relecture du 2026-11-17)

Déjà en place :
- Les tuiles OSM ne sont jamais chargées d'office (fond swisstopo par défaut).
- Les terrains sont précalculés, avec une pause de 5 s entre deux sites. Plusieurs serveurs Overpass sont essayés tour à tour, et une copie de secours existe.
- Attributions : swisstopo et geodienste.ch / OFAG sur leurs couches. La mention « © contributeurs OpenStreetMap » est affichée en permanence sur la carte (`attributionOsm`, ajoutée via `map.attributionControl`), car les aérodromes et les terrains viennent d'OSM.
- Bloc « Sources et crédits de cette page » en bas de [src/enveloppe-icosaedrique-3d.md](src/enveloppe-icosaedrique-3d.md), et ligne de crédit à la fin de `#hint` dans la vue 3D. Licence Art Libre « sauf mention contraire », lien en https.
- **Sources des textures de la vue 3D** (crédits ajoutés le 2026-11-17 en bas de page et sous la vue 3D) :
  - Carte vectorielle Airocean (`TEXB`, mode « Vecteur ») : créée par Philippe Rivière (son compte Observable s'appelle « Fil », d'où les adresses `@fil`), déjà crédité en bas de page (précision d'Erwan, 2026-11-17).
    - Notebooks de Philippe Rivière sur lesquels Erwan s'est appuyé : https://observablehq.com/@fil/airocean-projection · https://observablehq.com/@fil/a-conformal-airocean · https://observablehq.com/@fil/triangular-tiling-of-icosahedron
    - Contours des continents : les trois notebooks chargent `https://unpkg.com/visionscarto-world-atlas@0.0.6/world/110m_land.geojson` (version 0.0.4 pour « a-conformal-airocean »). Ce paquet de Philippe Rivière (licence BSD-3-Clause, https://github.com/Fil/visionscarto-world-atlas) reprend les données Natural Earth au 1:110 000 000, qui sont dans le domaine public. Il y ajoute quelques îles Kouriles.
    - Échelle vérifiée le 2026-11-17 : `TEXB` contient 102 taches de terre séparées (première image), contre 128 polygones dans `110m_land` et 1 427 dans `50m_land`. C'est donc le 110m : les plus petites îles font moins d'un pixel et disparaissent. Ce comptage ne permet pas de distinguer visionscarto-world-atlas du world-atlas de Mike Bostock, mais les deux viennent de Natural Earth, donc le crédit reste le même.
  - Photo NASA (`PHOTB`) : la source est connue (voir « Source de la photo NASA » plus haut). L'image est libre de droits, mais la NASA demande d'être citée et interdit d'utiliser son logo. Mention présente.
- **Nom de la carte** : ne parler que de « carte Airocean » (choix d'Erwan, 2026-11-17). « Dymaxion » et « Fuller Projection » sont des marques revendiquées par le Buckminster Fuller Institute : ne pas les employer dans les textes du site. Le nom de Buckminster Fuller, auteur de la carte, reste cité. « Airocean » est le nom donné par Fuller lui-même à la version de 1954 (« Airocean World Map ») ; la version de 1943 parue dans *Life* s'appelait « Dymaxion World ». La texture de la vue 3D suit l'orientation de Fuller et la transformation de Gray : elle est presque équivalente (surfaces conservées), pas conforme. La variante conforme du notebook « a-conformal-airocean » (sur le tétraèdre de Markley) est une autre carte. Exception : les titres de sources externes dans `src/data/neguentropie_Graph.json` restent tels quels.
- Langue : Framework 1.13 écrit `<html>` sans `lang`. Un petit script dans le `head` de [observablehq.config.js](observablehq.config.js) déclare `fr` au chargement.
- Carte Leaflet : `map.invalidateSize()` avant chaque `fitBounds` (elle s'était ouverte une fois au zoom 0). Les textes venant des données (`p.name`, `p.type`, `p.tourism`, `t.genre`) passent par `esc()` avant d'être insérés en HTML.

À corriger :
- **Overpass interrogé à chaque push** : `src/data/sites.json.js` est un data loader, et GitHub Actions repart sans cache Framework à chaque build. Il faut soit précalculer les aérodromes comme les terrains, soit mettre `.observablehq/cache` en cache dans le workflow.
- **API d'altitude geo.admin.ch** : `sites.json.js` refait 9 requêtes par site à chaque build. Les altitudes pourraient être précalculées, comme dans `generer-terrains.mjs`.
- **User-Agent** : `neguentropie-carte/1.0` ne permet pas de contacter l'auteur. Y ajouter l'URL du site ou une adresse de contact.
- **Raleway via Google Fonts** : chaque visiteur envoie son adresse IP à Google. Raleway est sous licence OFL, on peut donc l'héberger dans le dépôt, à la fois dans le site et dans la vue 3D.
- Pas de `meta description` ni de balises Open Graph : en ajouter une par page avec `head:` dans l'en-tête du fichier .md.
- Remplacer le favicon Observable.

## À faire / idées

- Comparer les couleurs du logo avec la version Mattermost si besoin.
- Gérer les multipolygones dans la recherche de terrains.
- Si le plan OSM devient très utilisé : générer nos propres tuiles vectorielles (extrait Geofabrik ou Protomaps → un fichier PMTiles pour la région, affiché avec `protomaps-leaflet`). Interdit d'aspirer les tuiles de tile.openstreetmap.org dans le build.
- Tenir ce fichier à jour à chaque évolution notable.
