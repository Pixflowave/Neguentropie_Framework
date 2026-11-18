// Altitudes swisstopo (api3.geo.admin.ch), communes aux scripts et au data loader des sites.

// WGS84 → LV95 (formule d'approximation de swisstopo)
export function toLV95(lat, lon) {
  const p = (lat * 3600 - 169028.66) / 10000, l = (lon * 3600 - 26782.5) / 10000;
  const E = 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p ** 2 - 44.54 * l ** 3;
  const N = 1200147.07 + 308807.95 * p + 3745.25 * l ** 2 + 76.63 * p ** 2 - 194.56 * l ** 2 * p + 119.79 * p ** 3;
  return {E, N};
}

export const pause = ms => new Promise(r => setTimeout(r, ms));

// Altitude d'un point ; `cache` (objet « lat,lon » → m), facultatif, évite de redemander un point
export async function hauteur(lat, lon, cache) {
  const k = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (cache && k in cache) return cache[k];
  const {E, N} = toLV95(lat, lon);
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://api3.geo.admin.ch/rest/services/height?easting=${E.toFixed(1)}&northing=${N.toFixed(1)}&sr=2056`,
        {signal: AbortSignal.timeout(20_000)});
      const h = parseFloat((await r.json()).height);
      if (Number.isFinite(h)) return cache ? (cache[k] = h) : h;
    } catch {}
    await pause(1000 * (i + 1));
  }
  throw new Error("altitude indisponible");
}

// Relief d'un site : altitude au centre et dénivelé entre le centre et 8 points à 300 m
export async function mesurerRelief(site, rayon = 300) {
  const dLat = rayon / 111320, dLon = rayon / (111320 * Math.cos(site.lat * Math.PI / 180));
  const pts = [[0, 0]];
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; pts.push([Math.sin(a), Math.cos(a)]); }
  const hs = await Promise.all(pts.map(([dx, dy]) => hauteur(site.lat + dy * dLat, site.lon + dx * dLon)));
  return {denivele: Math.round((Math.max(...hs) - Math.min(...hs)) * 10) / 10, altitude: Math.round(hs[0])};
}

// Clé d'un site dans src/data/reliefs.json
export const cleSite = s => `${s.lat},${s.lon}`;

export async function pool(items, fn, n = 6) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({length: n}, async () => {
    while (i < items.length) { const j = i++; try { out[j] = await fn(items[j]); } catch { out[j] = null; } }
  }));
  return out;
}
