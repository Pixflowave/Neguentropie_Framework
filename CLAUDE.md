# Neguentropie_Framework

Site Observable Framework publié sur GitHub Pages :
https://pixflowave.github.io/Neguentropie_Framework/

- Le déploiement se fait par GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) à chaque push sur `main` (environ 4 min). Plus de build quotidien depuis le 2026-11-17.
- `npm run dev` : aperçu local · `npm run build` : génère `dist/`.
- Répondre en français. Ne faire de commit ou de push qu'avec l'accord d'Erwan.

## Page « Enveloppe icosaédrique 3D »

[src/enveloppe-icosaedrique-3d.md](src/enveloppe-icosaedrique-3d.md) contient deux parties :
- la vue 3D, intégrée en iframe ;
- la carte Leaflet des sites de vol autour de Cossonay.

### Vue 3D de la montgolfière : [src/enveloppe-3d-viewer.html](src/enveloppe-3d-viewer.html)

C'est un fichier HTML autonome qui utilise three.js r128 (cdnjs) et OrbitControls r128 (jsDelivr). Les lignes 57-58 contiennent les textures de carte en base64 (environ 1,8 Mo) : ne jamais les lire ni les afficher en entier. Pour chercher dans le fichier, couper les lignes longues, par exemple avec `awk 'length($0)<3000'`.

- **Logo Fediverse sous la nacelle** (2026-11-17) : les câbles qui passent sous le plancher dessinent l'étoile, les patins cuir dessinent le pentagone, et une boule colorée marque chaque coin. Les couleurs sont dans l'objet `FEDI` (`bord`, `etoile`, `noeud`). Elles viennent de la version Wikimedia du logo et n'ont pas été comparées à celle de Mattermost.
- **Caméra** : OrbitControls permet de tourner dans tous les sens (y compris par-dessous), de zoomer à la molette ou au pincement, et de déplacer la vue au clic droit ou à deux doigts. Le double-clic recentre la vue. La rotation automatique s'arrête au premier geste. La lumière `sun` est attachée à la caméra.
- **Étiquettes** (tableau `LB`) :
  - Elles sont masquées par défaut (case « Étiquettes »).
  - Une fois affichées, elles se rangent en deux colonnes sur les bords du cadre et sont empilées sans chevauchement (fonction `stack`). Chacune est reliée à son point par un trait SVG (`#ld`).
  - Elles sont masquées quand la montgolfière occupe le cadre, c'est-à-dire quand il reste moins de 110 px de libre sur un côté. Elles ne réapparaissent qu'au-delà de 150 px, pour éviter le clignotement.
  - Sur téléphone, elles ne s'affichent donc presque jamais.
- **Vérifier le rendu sans navigateur** : prendre une capture avec Chrome sans fenêtre, par exemple `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --enable-unsafe-swiftshader --window-size=1400,900 --virtual-time-budget=6000 --screenshot=shot.png file:///chemin/vers/copie.html`. Ce mode ne sait pas descendre sous environ 500 px de large.

### Carte des sites de vol

- Les sites sont choisis à la main dans [src/data/sites-manuels.json](src/data/sites-manuels.json).
- Les aérodromes viennent d'Overpass ([src/data/sites.json.js](src/data/sites.json.js)), avec une copie de secours dans `aerodromes-secours.json`. Overpass sature souvent : il ne doit jamais être indispensable au build.
- Les terrains de 1 ha ou plus situés dans un rayon de 2 km sont précalculés par `npm run terrains` (sortie dans [src/data/terrains.json](src/data/terrains.json)). Relancer environ une fois par an, ou `npm run terrains -- "Nom"` pour un seul site.
- Aérodromes : pas de recherche de terrain. On y décolle avec l'accord du gestionnaire.
- Limite connue : seuls les `way` sont pris en compte, pas les multipolygones, si bien que Gruyères et Château de Chillon n'ont aucun terrain.

## Historique récent

| Date | Commit | Changement |
|---|---|---|
| 2026-11-17 | 162425c | Vue 3D : logo Fediverse, caméra libre, étiquettes en colonnes |
| 2026-11-17 | 3f34de7 | Terrains précalculés autour des sites choisis |

## À faire / idées

- Comparer les couleurs du logo avec la version Mattermost si besoin.
- Gérer les multipolygones dans la recherche de terrains.
- Tenir ce fichier à jour à chaque évolution notable.
