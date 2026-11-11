const cossonay = {lon: 6.5075, lat: 46.6202};

// [nom, lon, lat, type, intérêt touristique]
const manuels = [
  ["Lausanne - Ouchy", 6.6323, 46.5197, "Lac + Ville", "Lac Léman, vue Alpes"],
  ["Château de Chillon", 6.9275, 46.4116, "Patrimoine UNESCO", "Château médiéval"],
  ["Vevey - Riviera", 6.8358, 46.4750, "Lac + Culture", "Chaplin's World, Nestlé"],
  ["Montreux - Château", 6.911, 46.4330, "Lac + Montagne", "Jazz Festival, vue Lavaux"],
  ["Jussy - Chateaux du Crest", 6.2562, 46.2362, "Vignoble", "Vignobles, vue Châteaux"],
  ["Yverdon-les-Bains", 6.6398, 46.7781, "Thermal + Nature", "Thermes, parc naturel"],
  ["Nyon - Domaine de Divonne", 6.1376, 46.3575, "Lac + Golf", "Golf, lac, vue Jura"],
  ["Penthalaz - Domaine", 6.5800, 46.6500, "Campagne", "Vues panoramiques, calme"],
  ["Ecublens - Parc", 6.5660, 46.5190, "Innovation", "EPFL, lac proche"],
  ["La Sarraz - Château", 6.5111, 46.6567, "Château", "Château, musée du cheval"],
  ["Cully - Lavaux", 6.7311, 46.4880, "Vignoble", "Vignoble en terrasses, UNESCO"],
  ["Rolle - Château", 6.3415, 46.4588, "Château", "Château au bord du lac"],
  ["Grandson - Château", 6.6469, 46.8089, "Château", "Château, lac de Neuchâtel"],
  ["Sainte-Croix", 6.5000, 46.8222, "Jura", "Balcons du Jura, vue Alpes"],
  ["Estavayer-le-Lac", 6.8478, 46.8500, "Lac + Ville", "Vieille ville, château de Chenaux"],
  ["Gruyères", 7.0833, 46.5833, "Château", "Château, village médiéval"],
  ["Château-d'Œx", 7.1389, 46.4764, "Montagne + Ballons", "Capitale des ballons, Alpes vaudoises"],
  ["Avenches", 7.0425, 46.8804, "Patrimoine romain", "Site romain, plaine de la Broye"],
  ["Neuchâtel", 6.9313, 46.9920, "Lac + Ville", "Lac, château, vieille ville"],
  ["Fribourg", 7.1613, 46.8065, "Ville historique", "Vieille ville, cathédrale"],
  ["Morat", 7.1136, 46.9269, "Lac + Ville", "Ville fortifiée, lac de Morat"],
  ["Gstaad", 7.2861, 46.4749, "Montagne + Ballons", "Station alpine de prestige"],
  ["Berne", 7.4474, 46.9480, "Ville historique", "Vieille ville UNESCO, Alpes"],
  ["Zentrum Paul Klee (Berne)", 7.4739, 46.9492, "Musée + parc", "Musée de Renzo Piano, parc de sculptures"],
  ["Château de Prangins (Musée national)", 6.2516, 46.3942, "Musée + parc", "Château du XVIIIe siècle, jardins, vue sur le Léman"]
].map(([name, lon, lat, type, tourism]) => ({name, lon, lat, type, tourism}));

// Aérodromes à code OACI (OpenStreetMap), avec un second serveur en secours
async function aerodromes() {
  const q = `[out:json][timeout:60];nwr["aeroway"="aerodrome"]["icao"](around:100000,${cossonay.lat},${cossonay.lon});out center tags;`;
  for (const url of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {"User-Agent": "neguentropie-carte/1.0", "Content-Type": "application/x-www-form-urlencoded"},
        body: "data=" + encodeURIComponent(q)
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return d.elements
        .map(e => ({
          lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon,
          name: `${e.tags?.name ?? "Aérodrome"} (${e.tags.icao})`,
          type: "Aérodrome", tourism: "Décollage possible avec autorisation de la tour"
        }))
        .filter((a, i, tab) => a.lat != null && a.lon != null && tab.findIndex(t => t.name === a.name) === i);
    } catch (err) {
      console.error(`Overpass ${url} : ${err.message}`);
    }
  }
  throw new Error("Aérodromes : aucun serveur Overpass n'a répondu");
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