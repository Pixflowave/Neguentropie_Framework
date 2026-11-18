// Génère src/data/terrains.json : les terrains d'au moins 1 ha dans un rayon de 2 km
// autour de chaque site choisi (src/data/sites-manuels.json), avec leur dénivelé.
//
// Les données OSM viennent de la bibliothèque GeoDesk locale (voir scripts/osm.mjs) :
// la (re)charger d'abord avec  npm run osm  si elle manque ou date de plus d'un an.
//
// À lancer à la main, environ une fois par an :  npm run terrains
// Pour ne recalculer que certains sites (le reste du fichier est conservé) :
//   npm run terrains -- "Gruyères" "Château de Chillon"
// Les altitudes déjà mesurées sont gardées dans scripts/.cache-altitudes.json :
// si le script s'interrompt, il suffit de le relancer, il reprend où il en était.

import {readFileSync, writeFileSync, existsSync} from "node:fs";
import {racine, verifier, requete, R, rad} from "./osm.mjs";
import {hauteur, pool} from "./relief.mjs";

const RAYON = 2000;      // mètres autour de chaque site
const SURFACE_MIN = 1;   // hectares
const REQUETE = "a[landuse=meadow,farmland,grass,greenfield], a[leisure=park,pitch,common], a[natural=grassland]";

const demandes = process.argv.slice(2);
const tousLesSites = JSON.parse(readFileSync(new URL("src/data/sites-manuels.json", racine), "utf8"));
const sites = demandes.length ? tousLesSites.filter(s => demandes.includes(s.name)) : tousLesSites;
if (demandes.length && sites.length !== demandes.length) {
  console.error("Site(s) inconnu(s) :", demandes.filter(n => !sites.some(s => s.name === n)).join(", "));
  process.exit(1);
}
const fichierCache = new URL("scripts/.cache-altitudes.json", racine);
const cache = existsSync(fichierCache) ? JSON.parse(readFileSync(fichierCache, "utf8")) : {};

const revision = verifier();
const surfaces = site => requete(REQUETE, site, RAYON, "landuse,leisure,natural", 5);

// --- Géométrie --------------------------------------------------------------------
function distance(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Polygones GeoJSON → liste de polygones, chacun = [contour extérieur, trous…], anneaux en {lat, lon}
function polygones(geom) {
  const liste = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  return liste.map(p => p.map(anneau => anneau.map(([lon, lat]) => ({lat, lon}))));
}
// Aire (ha) et centroïde, trous déduits, en projection locale (suffisant à cette échelle)
function aireEtCentre(polys) {
  const lat0 = rad(polys[0][0][0].lat), x = p => rad(p.lon) * R * Math.cos(lat0), y = p => rad(p.lat) * R;
  let A = 0, cx = 0, cy = 0;
  for (const p of polys) p.forEach((g, k) => {
    let a = 0, gx = 0, gy = 0;
    for (let i = 0; i < g.length - 1; i++) {
      const c = x(g[i]) * y(g[i + 1]) - x(g[i + 1]) * y(g[i]);
      a += c; gx += (x(g[i]) + x(g[i + 1])) * c; gy += (y(g[i]) + y(g[i + 1])) * c;
    }
    const s = (k === 0 ? 1 : -1) * Math.sign(a);  // extérieur compté en plus, trous en moins
    A += s * a / 2; cx += s * gx / 6; cy += s * gy / 6;
  });
  cx /= A; cy /= A;
  return {ha: A / 10000, lat: cy / R * 180 / Math.PI, lon: cx / (R * Math.cos(lat0)) * 180 / Math.PI};
}
const arrondi = v => Math.round(v * 1e5) / 1e5;  // ≈ 1 m
const anneau = g => g.map(p => [arrondi(p.lat), arrondi(p.lon)]);
// Format de `contour`, accepté tel quel par L.polygon de Leaflet :
// polygone simple → [[lat, lon], …] (comme avant) ; avec trous → [extérieur, trou, …] ;
// en plusieurs parties → [[extérieur, trou…], …]
function contour(polys) {
  if (polys.length > 1) return polys.map(p => p.map(anneau));
  return polys[0].length > 1 ? polys[0].map(anneau) : anneau(polys[0][0]);
}

// --- Génération -------------------------------------------------------------------
const sortie = new URL("src/data/terrains.json", racine);
const precedent = demandes.length && existsSync(sortie) ? JSON.parse(readFileSync(sortie, "utf8")).sites : {};
const resultat = {...precedent};
for (const [n, site] of sites.entries()) {
  console.log(`[${n + 1}/${sites.length}] ${site.name}`);
  const terrains = [];
  for (const f of surfaces(site)) {
    const polys = polygones(f.geometry).filter(p => p[0].length >= 4);
    if (!polys.length) continue;
    const {ha, lat, lon} = aireEtCentre(polys);
    if (ha < SURFACE_MIN) continue;
    const t = f.properties ?? {};
    terrains.push({polys, ha, lat, lon, genre: t.landuse ?? t.leisure ?? t.natural});
  }
  // Dénivelé d'un terrain : centre + jusqu'à 8 points répartis sur le contour de sa plus grande partie
  const deniveles = await pool(terrains, async t => {
    const g = t.polys.map(p => p[0]).reduce((a, b) => (b.length > a.length ? b : a));
    const pas = Math.max(1, Math.floor(g.length / 8));
    const pts = [{lat: t.lat, lon: t.lon}, ...g.filter((_, i) => i % pas === 0).slice(0, 8)];
    const hs = [];
    for (const p of pts) hs.push(await hauteur(p.lat, p.lon, cache));
    return Math.max(...hs) - Math.min(...hs);
  });
  resultat[site.name] = terrains.map((t, i) => ({
    ha: Math.round(t.ha * 10) / 10,
    genre: t.genre,
    dist: Math.round(distance(site, t)),
    denivele: deniveles[i] != null ? Math.round(deniveles[i] * 10) / 10 : null,
    contour: contour(t.polys)
  })).sort((a, b) => a.dist - b.dist || b.ha - a.ha || JSON.stringify(a.contour).localeCompare(JSON.stringify(b.contour)));
  console.log(`  ${terrains.length} terrain(s) ≥ ${SURFACE_MIN} ha`);
  writeFileSync(fichierCache, JSON.stringify(cache));
}

writeFileSync(sortie, JSON.stringify({genere: new Date().toISOString().slice(0, 10), osm: revision, rayon: RAYON, sites: resultat}));
const total = Object.values(resultat).reduce((s, t) => s + t.length, 0);
console.log(`\n${total} terrains enregistrés dans src/data/terrains.json`);
