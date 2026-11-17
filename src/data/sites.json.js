import {readFileSync} from "node:fs";

const cossonay = {lon: 6.5075, lat: 46.6202};

// Sites choisis à la main (nom, coordonnées, type, intérêt touristique)
const manuels = JSON.parse(readFileSync(new URL("./sites-manuels.json", import.meta.url), "utf8"));

// Aérodromes à code OACI (OpenStreetMap). Trois serveurs Overpass essayés tour à tour,
// 90 s maximum chacun ; s'ils sont tous indisponibles, on reprend la copie de secours
// (aerodromes-secours.json) au lieu de faire échouer le build.
async function aerodromes() {
  const q = `[out:json][timeout:60];nwr["aeroway"="aerodrome"]["icao"](around:100000,${cossonay.lat},${cossonay.lon});out center tags;`;
  for (const url of ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {"User-Agent": "neguentropie-carte/1.0", "Content-Type": "application/x-www-form-urlencoded"},
        body: "data=" + encodeURIComponent(q),
        signal: AbortSignal.timeout(90_000)
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return d.elements
        .map(e => ({
          lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon,
          name: `${e.tags?.name ?? "Aérodrome"} (${e.tags.icao})`,
          type: "Aérodrome", tourism: "Décollage depuis l'aérodrome, avec l'accord du gestionnaire"
        }))
        .filter((a, i, tab) => a.lat != null && a.lon != null && tab.findIndex(t => t.name === a.name) === i);
    } catch (err) {
      console.error(`Overpass ${url} : ${err.message}`);
    }
  }
  console.error("Aérodromes : aucun serveur Overpass n'a répondu, copie de secours utilisée");
  return JSON.parse(readFileSync(new URL("./aerodromes-secours.json", import.meta.url), "utf8"));
}

// WGS84 → LV95 (formule d'approximation de swisstopo)
function toLV95(lat, lon) {
  const p = (lat * 3600 - 169028.66) / 10000, l = (lon * 3600 - 26782.5) / 10000;
  const E = 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p ** 2 - 44.54 * l ** 3;
  const N = 1200147.07 + 308807.95 * p + 3745.25 * l ** 2 + 76.63 * p ** 2 - 194.56 * l ** 2 * p + 119.79 * p ** 3;
  return {E, N};
}

async function hauteur(lat, lon, essais = 3) {
  const {E, N} = toLV95(lat, lon);
  for (let i = 0; i < essais; i++) {
    try {
      const r = await fetch(`https://api3.geo.admin.ch/rest/services/height?easting=${E.toFixed(1)}&northing=${N.toFixed(1)}&sr=2056`);
      const h = parseFloat((await r.json()).height);
      if (Number.isFinite(h)) return h;
    } catch {}
    await new Promise(res => setTimeout(res, 500 * (i + 1)));
  }
  throw new Error("hauteur indisponible");
}

async function mesurerRelief(site, rayon = 300) {
  const dLat = rayon / 111320, dLon = rayon / (111320 * Math.cos(site.lat * Math.PI / 180));
  const pts = [[0, 0]];
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; pts.push([Math.sin(a), Math.cos(a)]); }
  const hs = await Promise.all(pts.map(([dx, dy]) => hauteur(site.lat + dy * dLat, site.lon + dx * dLon)));
  return {denivele: Math.max(...hs) - Math.min(...hs), altitude: hs[0]};
}

async function pool(items, fn, n = 6) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({length: n}, async () => {
    while (i < items.length) { const j = i++; try { out[j] = await fn(items[j]); } catch { out[j] = null; } }
  }));
  return out;
}

const sites = [...manuels, ...(await aerodromes())];
const reliefs = await pool(sites, s => mesurerRelief(s));

process.stdout.write(JSON.stringify(sites.map((s, i) => ({
  ...s,
  denivele: reliefs[i] ? Math.round(reliefs[i].denivele * 10) / 10 : null,
  altitude: reliefs[i] ? Math.round(reliefs[i].altitude) : null
}))));