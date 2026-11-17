// Génère src/data/terrains.json : les terrains d'au moins 1 ha dans un rayon de 2 km
// autour de chaque site choisi (src/data/sites-manuels.json), avec leur dénivelé.
//
// À lancer à la main, environ une fois par an :  npm run terrains
// Pour ne recalculer que certains sites (le reste du fichier est conservé) :
//   npm run terrains -- "Gruyères" "Château de Chillon"
// Les altitudes déjà mesurées sont gardées dans scripts/.cache-altitudes.json :
// si le script s'interrompt, il suffit de le relancer, il reprend où il en était.

import {readFileSync, writeFileSync, existsSync} from "node:fs";

const RAYON = 2000;      // mètres autour de chaque site
const SURFACE_MIN = 1;   // hectares
const SERVEURS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

const racine = new URL("../", import.meta.url);
const tousLesSites = JSON.parse(readFileSync(new URL("src/data/sites-manuels.json", racine), "utf8"));
const demandes = process.argv.slice(2);
const sites = demandes.length ? tousLesSites.filter(s => demandes.includes(s.name)) : tousLesSites;
if (demandes.length && sites.length !== demandes.length) {
  console.error("Site(s) inconnu(s) :", demandes.filter(n => !sites.some(s => s.name === n)).join(", "));
  process.exit(1);
}
const fichierCache = new URL("scripts/.cache-altitudes.json", racine);
const cache = existsSync(fichierCache) ? JSON.parse(readFileSync(fichierCache, "utf8")) : {};
const pause = ms => new Promise(r => setTimeout(r, ms));

// --- Overpass : terrains autour d'un site -----------------------------------------
async function overpass(site) {
  const a = `around:${RAYON},${site.lat},${site.lon}`;
  const q = `[out:json][timeout:60];(
    way(${a})["landuse"~"^(meadow|farmland|grass|greenfield)$"];
    way(${a})["leisure"~"^(park|pitch|common)$"];
    way(${a})["natural"="grassland"];
  );out geom;`;
  for (let tour = 0; tour < 4; tour++) {
    for (const url of SERVEURS) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: {"User-Agent": "neguentropie-carte/1.0", "Content-Type": "application/x-www-form-urlencoded"},
          body: "data=" + encodeURIComponent(q),
          signal: AbortSignal.timeout(90_000)
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        // Requête interrompue côté serveur : réponse « valide » mais incomplète
        if (d.remark && /error|timeout|out of memory/i.test(d.remark)) throw new Error(d.remark);
        return d.elements;
      } catch (err) {
        console.error(`  Overpass ${new URL(url).host} : ${err.message}`);
      }
    }
    await pause(30_000 * (tour + 1));  // serveurs saturés : on patiente avant un nouveau tour
  }
  throw new Error(`Overpass indisponible pour ${site.name}`);
}

// --- Géométrie --------------------------------------------------------------------
const R = 6371000, rad = d => d * Math.PI / 180;
function distance(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Aire (ha) et centroïde d'un polygone fermé, en projection locale (suffisant à cette échelle)
function aireEtCentre(g) {
  const lat0 = rad(g[0].lat), x = p => rad(p.lon) * R * Math.cos(lat0), y = p => rad(p.lat) * R;
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < g.length - 1; i++) {
    const c = x(g[i]) * y(g[i + 1]) - x(g[i + 1]) * y(g[i]);
    A += c; cx += (x(g[i]) + x(g[i + 1])) * c; cy += (y(g[i]) + y(g[i + 1])) * c;
  }
  A /= 2; cx /= 6 * A; cy /= 6 * A;
  return {ha: Math.abs(A) / 10000, lat: cy / R * 180 / Math.PI, lon: cx / (R * Math.cos(lat0)) * 180 / Math.PI};
}
const arrondi = v => Math.round(v * 1e5) / 1e5;  // ≈ 1 m

// --- Altitudes swisstopo ------------------------------------------------------------
function toLV95(lat, lon) {
  const p = (lat * 3600 - 169028.66) / 10000, l = (lon * 3600 - 26782.5) / 10000;
  const E = 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p ** 2 - 44.54 * l ** 3;
  const N = 1200147.07 + 308807.95 * p + 3745.25 * l ** 2 + 76.63 * p ** 2 - 194.56 * l ** 2 * p + 119.79 * p ** 3;
  return {E, N};
}
async function hauteur(lat, lon) {
  const k = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (k in cache) return cache[k];
  const {E, N} = toLV95(lat, lon);
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://api3.geo.admin.ch/rest/services/height?easting=${E.toFixed(1)}&northing=${N.toFixed(1)}&sr=2056`,
        {signal: AbortSignal.timeout(20_000)});
      const h = parseFloat((await r.json()).height);
      if (Number.isFinite(h)) return (cache[k] = h);
    } catch {}
    await pause(1000 * (i + 1));
  }
  throw new Error("altitude indisponible");
}
async function pool(items, fn, n = 6) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({length: n}, async () => {
    while (i < items.length) { const j = i++; try { out[j] = await fn(items[j]); } catch { out[j] = null; } }
  }));
  return out;
}

// --- Génération -------------------------------------------------------------------
const sortie = new URL("src/data/terrains.json", racine);
const precedent = demandes.length && existsSync(sortie) ? JSON.parse(readFileSync(sortie, "utf8")).sites : {};
const resultat = {...precedent};
for (const [n, site] of sites.entries()) {
  console.log(`[${n + 1}/${sites.length}] ${site.name}`);
  const elements = await overpass(site);
  const terrains = [];
  for (const w of elements) {
    const g = w.geometry;
    if (!g || g.length < 4 || g[0].lat !== g.at(-1).lat || g[0].lon !== g.at(-1).lon) continue;
    const {ha, lat, lon} = aireEtCentre(g);
    if (ha < SURFACE_MIN) continue;
    terrains.push({g, ha, lat, lon, genre: w.tags?.landuse ?? w.tags?.leisure ?? w.tags?.natural});
  }
  // Dénivelé d'un terrain : centre + jusqu'à 8 points répartis sur son contour
  const deniveles = await pool(terrains, async t => {
    const pas = Math.max(1, Math.floor(t.g.length / 8));
    const pts = [{lat: t.lat, lon: t.lon}, ...t.g.filter((_, i) => i % pas === 0).slice(0, 8)];
    const hs = [];
    for (const p of pts) hs.push(await hauteur(p.lat, p.lon));
    return Math.max(...hs) - Math.min(...hs);
  });
  resultat[site.name] = terrains.map((t, i) => ({
    ha: Math.round(t.ha * 10) / 10,
    genre: t.genre,
    dist: Math.round(distance(site, t)),
    denivele: deniveles[i] != null ? Math.round(deniveles[i] * 10) / 10 : null,
    contour: t.g.map(p => [arrondi(p.lat), arrondi(p.lon)])
  })).sort((a, b) => a.dist - b.dist);
  console.log(`  ${terrains.length} terrain(s) ≥ ${SURFACE_MIN} ha`);
  writeFileSync(fichierCache, JSON.stringify(cache));
  await pause(5000);  // ménager les serveurs Overpass entre deux sites
}

writeFileSync(sortie, JSON.stringify({genere: new Date().toISOString().slice(0, 10), rayon: RAYON, sites: resultat}));
const total = Object.values(resultat).reduce((s, t) => s + t.length, 0);
console.log(`\n${total} terrains enregistrés dans src/data/terrains.json`);
