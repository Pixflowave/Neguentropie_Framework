---
title: Enveloppe icosaédrique 3D
toc: false
---

# Enveloppe icosaédrique 3 750 m³

```js
import {html} from "npm:htl";
const viewerUrl = await FileAttachment("enveloppe-3d-viewer.html").url();

display(html`
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
  <span style="color: var(--theme-foreground-muted); font-size: 0.95rem;">
    Visualisation 3D interactive (Three.js) &middot; Arête 12 m, hauteur &approx; 21 m, 3 passagers + 1 pilote
  </span>
  <a href="${viewerUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--theme-foreground-focus, #3b82f6); color: white; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: 500;">
    <span>Ouvrir en plein écran</span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
  </a>
</div>

<div class="card" style="padding: 0; overflow: hidden; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid var(--theme-foreground-faintest);">
  <iframe
    src="${viewerUrl}"
    width="100%"
    height="780"
    style="border: none; display: block; width: 100%; height: 75vh; min-height: 600px;"
    title="Enveloppe icosaédrique 3D">
  </iframe>
</div>
`);
```
---

## 🎈 Points de décollage potentiels de montgolfière

Carte des sites autour de **Cossonay-Ville (Suisse)**. Réglez le rayon et le dénivelé maximal avec les curseurs.

*Critères : intérêt touristique prestigieux pour la clientèle | terrain relativement plat*

```js
// Sites : calculés à la construction (voir src/data/sites.json.js)
const cossonay = {lon: 6.5075, lat: 46.6202, name: "Cossonay-Ville"};
const sites = await FileAttachment("data/sites.json").json();

function haversineDistance(coord1, coord2) {
  const R = 6371;
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLon = (coord2.lon - coord1.lon) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const types = [...new Set(sites.map(p => p.type))];
const colorScale = d3.scaleOrdinal(types, d3.quantize(t => d3.interpolateRainbow(t * 0.9), types.length));

// Altitude en direct (utilisée pour les terrains voisins)
function toLV95(lat, lon) {
  const p = (lat * 3600 - 169028.66) / 10000, l = (lon * 3600 - 26782.5) / 10000;
  const E = 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p ** 2 - 44.54 * l ** 3;
  const N = 1200147.07 + 308807.95 * p + 3745.25 * l ** 2 + 76.63 * p ** 2 - 194.56 * l ** 2 * p + 119.79 * p ** 3;
  return {E, N};
}

async function hauteur(lat, lon) {
  const k = `h:${lat.toFixed(5)},${lon.toFixed(5)}`;
  try { const c = localStorage.getItem(k); if (c) return +c; } catch {}
  const {E, N} = toLV95(lat, lon);
  const r = await fetch(`https://api3.geo.admin.ch/rest/services/height?easting=${E.toFixed(1)}&northing=${N.toFixed(1)}&sr=2056`);
  const h = parseFloat((await r.json()).height);
  if (!Number.isFinite(h)) throw new Error("hauteur indisponible");
  try { localStorage.setItem(k, String(h)); } catch {}
  return h;
}

async function pool(items, fn, n = 6) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({length: n}, async () => {
    while (i < items.length) { const j = i++; try { out[j] = await fn(items[j]); } catch { out[j] = null; } }
  }));
  return out;
}
```

```js
const radiusKm = view(Inputs.range([10, 100], {value: 60, step: 5, label: "Rayon (km)"}));
```

```js
const denivMax = view(Inputs.range([10, 100], {value: 30, step: 5, label: "Dénivelé max (m, rayon 300 m)"}));
```

```js
const dans = sites.filter(p => haversineDistance(cossonay, p) <= radiusKm);
const validPoints = dans.filter(p => p.denivele == null || p.denivele <= denivMax);
const ecartes = dans.filter(p => !validPoints.includes(p));

display(html`<p><strong>${validPoints.length} site${validPoints.length > 1 ? "s" : ""}</strong> dans un rayon de ${radiusKm} km autour de ${cossonay.name}.</p>`);
```

```js
// Carte créée UNE SEULE FOIS (elle ne dépend pas des curseurs)
// Choix des couches AU-DESSUS de la carte, légende EN DESSOUS (rien ne recouvre la carte sur smartphone)
const layersDiv = display(document.createElement("div"));
layersDiv.style = "margin-bottom: 8px;";
const mapDiv = display(document.createElement("div"));
mapDiv.style = "height: 600px; max-height: 70vh; width: 100%; border-radius: 8px;";
const legendDiv = display(document.createElement("div"));
legendDiv.style = "margin-top: 8px; font-size: 13px; line-height: 1.6;";

const map = L.map(mapDiv, {
  zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
  wheelPxPerZoomLevel: 240, wheelDebounceTime: 60, zoomSnap: 0.5
}).setView([cossonay.lat, cossonay.lon], 9);
let alive = true;
invalidation.then(() => { alive = false; map.remove(); });

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20, maxNativeZoom: 19, zIndex: 1,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const satellite = L.tileLayer("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg", {
  maxZoom: 20, maxNativeZoom: 20, zIndex: 2, attribution: "&copy; swisstopo"
});
const carteNationale = L.tileLayer("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg", {
  maxZoom: 20, maxNativeZoom: 18, zIndex: 2, attribution: "&copy; swisstopo"
});
const ombrage = L.tileLayer("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissalti3d-reliefschattierung/default/current/3857/{z}/{x}/{y}.png", {
  maxZoom: 20, maxNativeZoom: 17, opacity: 0.5, zIndex: 3, attribution: "&copy; swisstopo"
});
satellite.addTo(map);

const wmsUrl = "https://wfs.geodienste.ch/lwb_biodiversitaetsfoerderflaechen_v2_0_0/fra";
const wmsOpts = {format: "image/png", transparent: true, opacity: 0.65, zIndex: 4,
  attribution: "Source : geodienste.ch, cantons / OFAG"};
const spbQ2 = L.tileLayer.wms(wmsUrl, {...wmsOpts, layers: "spb_qualite_2_surfaces"});
const spbReseau = L.tileLayer.wms(wmsUrl, {...wmsOpts, layers: "spb_reseau_surfaces"});
const dispo = L.tileLayer.wms(wmsUrl, {...wmsOpts, layers: "disponibilite_cantons", opacity: 0.5, zIndex: 5});

const controleCouches = L.control.layers(
  {
    "Plan (OpenStreetMap)": L.layerGroup(),
    "Vue satellite (swisstopo)": satellite,
    "Carte nationale, courbes de niveau (swisstopo)": carteNationale
  },
  {
    "Relief ombré (swisstopo)": ombrage,
    "SPB qualité II (jachères, prairies…)": spbQ2,
    "SPB mises en réseau (zoom requis)": spbReseau,
    "Disponibilité des données par canton": dispo
  },
  {collapsed: false}
).addTo(map);

// Sortir le sélecteur de la carte : on déplace son élément dans layersDiv
const layersCtl = controleCouches.getContainer();
layersDiv.append(layersCtl);
layersCtl.style.cssText = "margin:0;float:none;width:100%;box-sizing:border-box;box-shadow:none;border:1px solid var(--theme-foreground-faintest);border-radius:8px;background:var(--theme-background-alt, #fff);color:inherit;font-size:13px;";
const liste = layersCtl.querySelector(".leaflet-control-layers-list");
liste.style.cssText = "display:flex;flex-wrap:wrap;gap:4px 24px;";
liste.querySelector(".leaflet-control-layers-separator").style.display = "none";

const groupeSites = L.layerGroup().addTo(map);
const terrains = L.layerGroup().addTo(map);

// Terrains ≥ 1 ha autour d'un site, avec leur dénivelé
async function chercherTerrains(p, bouton, seuil) {
  bouton.disabled = true; bouton.textContent = "Recherche…";
  const q = `[out:json][timeout:25];(
    way(around:1500,${p.lat},${p.lon})["landuse"~"^(meadow|farmland|grass|greenfield)$"];
    way(around:1500,${p.lat},${p.lon})["leisure"~"^(park|pitch|common)$"];
    way(around:1500,${p.lat},${p.lon})["natural"="grassland"];
  );out geom;`;
  try {
    const r = await fetch("https://overpass-api.de/api/interpreter", {method: "POST", body: "data=" + encodeURIComponent(q)});
    const data = await r.json();
    if (!alive) return;
    const candidats = [];
    for (const w of data.elements) {
      const g = w.geometry;
      if (!g || g.length < 4) continue;
      if (g[0].lat !== g.at(-1).lat || g[0].lon !== g.at(-1).lon) continue;
      const poly = {type: "Polygon", coordinates: [g.map(({lon, lat}) => [lon, lat])]};
      const a = d3.geoArea(poly);
      const ha = Math.min(a, 4 * Math.PI - a) * 6371000 ** 2 / 10000;
      if (ha < 1) continue;
      const [clon, clat] = d3.geoCentroid(poly);
      candidats.push({
        g, ha, clat, clon,
        genre: w.tags?.landuse ?? w.tags?.leisure ?? w.tags?.natural,
        dist: Math.round(haversineDistance(p, {lat: clat, lon: clon}) * 1000)
      });
    }
    bouton.textContent = `Mesure du dénivelé de ${candidats.length} terrain(s)…`;
    // Dénivelé d'un terrain : centre + jusqu'à 8 points répartis sur son contour
    const mesures = await pool(candidats, async c => {
      const pas = Math.max(1, Math.floor(c.g.length / 8));
      const pts = [{lat: c.clat, lon: c.clon}, ...c.g.filter((_, i) => i % pas === 0).slice(0, 8)];
      const hs = await Promise.all(pts.map(pt => hauteur(pt.lat, pt.lon)));
      return Math.max(...hs) - Math.min(...hs);
    }, 4);
    if (!alive) return;
    terrains.clearLayers();
    let plats = 0;
    candidats.forEach((c, i) => {
      const d = mesures[i], plat = d != null && d <= seuil;
      if (plat) plats++;
      L.polygon(c.g.map(({lat, lon}) => [lat, lon]), {color: plat ? "#00e676" : "#ff9800", weight: 2, fillOpacity: 0.25})
        .bindTooltip(`${c.ha.toFixed(1)} ha · à ${c.dist} m de ${p.name}<br>${c.genre}<br>Dénivelé : ${d != null ? Math.round(d) + " m" : "?"}`)
        .addTo(terrains);
    });
    bouton.textContent = candidats.length
      ? `${plats} terrain(s) plat(s) sur ${candidats.length} (≥ 1 ha)`
      : "Aucun terrain ≥ 1 ha trouvé";
  } catch (err) {
    bouton.textContent = "Recherche impossible : réessayer";
  } finally {
    bouton.disabled = false;
  }
}

// Clic sur la carte : type de surface de biodiversité (GetFeatureInfo)
const codesSPB = {
  "556": "Jachère florale", "557": "Jachère tournante", "559": "Ourlet sur terre assolée",
  "572": "Bande semée pour organismes utiles",
  "594": "SPB spécifique à la région (terres ouvertes)",
  "611": "Prairie extensive", "612": "Prairie peu intensive",
  "617": "Pâturage extensif", "618": "Pâturage boisé",
  "622": "Prairie de fauche d'estivage (type extensive)", "623": "Prairie de fauche d'estivage (type peu intensive)",
  "635": "Prairie riveraine d'un cours d'eau",
  "693": "SPB spécifique à la région (pâturages)", "694": "SPB spécifique à la région (prairies)",
  "701": "Vigne", "717": "Vigne à biodiversité naturelle", "735": "Vigne (SPB spécifique à la région)",
  "851": "Surface à litière", "852": "Haie, bosquet champêtre, berge boisée",
  "904": "Fossé humide, mare, étang", "905": "Surface rudérale, tas d'épierrage, rocher", "906": "Mur de pierres sèches",
  "921": "Arbres fruitiers haute-tige", "922": "Noyers", "923": "Châtaigniers", "950": "Bande culturale extensive",
  "930": "Pâturage d'estivage", "933": "Pâturage communautaire", "935": "Prairie de fauche d'estivage", "936": "Surface à litière (estivage)"
};
const codesJachere = new Set(["556", "557"]);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

function parseFeatureInfo(txt) {
  const out = []; let layer = "", cur = null;
  for (const line of txt.split("\n")) {
    const l = line.match(/^Layer '(.+)'/);
    if (l) { layer = l[1]; cur = null; continue; }
    if (/^\s*Feature \d+:/.test(line)) { cur = {layer, attrs: {}}; out.push(cur); continue; }
    const kv = line.match(/^\s+(\S+)\s*=\s*'(.*)'\s*$/);
    if (kv && cur) cur.attrs[kv[1]] = kv[2];
  }
  return out;
}

function popupSPB(features) {
  if (!features.length) return "Aucune surface de biodiversité à cet endroit.";
  return features.map(f => {
    const a = f.attrs, code = a.Code_utilisation;
    const label = codesSPB[code] ?? (code ? `Code ${code} (absent du catalogue fédéral 2026)` : "Surface de biodiversité");
    const badge = codesJachere.has(code)
      ? ` <span style="background:#2e7d32;color:#fff;border-radius:4px;padding:1px 6px;font-size:11px">JACHÈRE</span>` : "";
    const m2 = a.Surface_m2 ? +a.Surface_m2 : null;
    const lines = [
      m2 != null && `${m2.toLocaleString("fr-CH")} m² (${(m2 / 10000).toFixed(2)} ha)`,
      a.Année_de_référence && `Année : ${esc(a.Année_de_référence)}`,
      a.Canton && `Canton : ${esc(a.Canton)}`,
      a.Identificateur && `Réf. : ${esc(a.Identificateur)}`
    ].filter(Boolean);
    if (!code && m2 == null) {
      lines.push(...Object.entries(a).filter(([, v]) => v).map(([k, v]) => `${esc(k)} : ${esc(v)}`));
    }
    return `<div style="color:#222;font-size:13px;line-height:1.5"><strong>${esc(label)}</strong>${badge}<br>${lines.join("<br>")}</div>`;
  }).join('<hr style="margin:6px 0">');
}

map.on("click", async (e) => {
  const active = [[spbQ2, "spb_qualite_2_surfaces"], [spbReseau, "spb_reseau_surfaces"]]
    .filter(([layer]) => map.hasLayer(layer)).map(([, name]) => name).join(",");
  if (!active) return;
  const size = map.getSize(), b = map.getBounds(), crs = map.options.crs;
  const sw = crs.project(b.getSouthWest()), ne = crs.project(b.getNorthEast());
  const pt = map.latLngToContainerPoint(e.latlng);
  const params = new URLSearchParams({
    SERVICE: "WMS", VERSION: "1.3.0", REQUEST: "GetFeatureInfo",
    LAYERS: active, QUERY_LAYERS: active, STYLES: "", CRS: "EPSG:3857",
    BBOX: [sw.x, sw.y, ne.x, ne.y].join(","),
    WIDTH: size.x, HEIGHT: size.y, I: Math.round(pt.x), J: Math.round(pt.y),
    INFO_FORMAT: "text/plain", FEATURE_COUNT: 5
  });
  const popup = L.popup({maxWidth: 260}).setLatLng(e.latlng).setContent("Recherche…").openOn(map);
  try {
    const r = await fetch(`${wmsUrl}?${params}`);
    const txt = (await r.text()).trim();
    if (!alive) return;
    popup.setContent(popupSPB(parseFeatureInfo(txt)));
  } catch (err) {
    if (alive) popup.setContent("Information indisponible (le serveur refuse la requête depuis cette page).");
  }
});
```

```js
// Mise à jour des marqueurs quand les curseurs changent (la carte n'est pas recréée)
groupeSites.clearLayers();

const used = [...new Set(validPoints.map(p => p.type))];
legendDiv.innerHTML = "<strong>Type de site :</strong> " + used.map(t =>
  `<span style="display:inline-flex;align-items:center;margin-right:14px;white-space:nowrap"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorScale(t)};margin-right:6px"></span>${t}</span>`
).join("");

L.circle([cossonay.lat, cossonay.lon], {
  radius: radiusKm * 1000, color: "#ff0000", weight: 2, dashArray: "6 6", fillOpacity: 0.03, interactive: false
}).addTo(groupeSites);

L.circleMarker([cossonay.lat, cossonay.lon], {
  radius: 9, color: "#fff", weight: 2, fillColor: "#ff0000", fillOpacity: 1, bubblingMouseEvents: false
}).addTo(groupeSites).bindTooltip(cossonay.name, {permanent: true, direction: "right"});

for (const p of validPoints) {
  L.circleMarker([p.lat, p.lon], {
    radius: 8, color: "#fff", weight: 1.5, fillColor: colorScale(p.type), fillOpacity: 0.9,
    bubblingMouseEvents: false
  })
  .addTo(groupeSites)
  .bindTooltip(p.name, {direction: "top"})
  .bindPopup(() => {
    const div = document.createElement("div");
    div.style.cssText = "color:#222;font-size:13px;line-height:1.5";
    div.innerHTML = `<strong>${p.name}</strong><br>${p.type}<br>${p.tourism}<br>
      ${haversineDistance(cossonay, p).toFixed(1)} km de Cossonay<br>
      Dénivelé (300 m) : ${p.denivele != null ? Math.round(p.denivele) + " m" : "?"}<br>`;
    const btn = document.createElement("button");
    btn.textContent = "Chercher des terrains ≥ 1 ha (1,5 km)";
    btn.style.cssText = "margin-top:6px;padding:4px 8px;cursor:pointer";
    btn.onclick = () => chercherTerrains(p, btn, denivMax);
    div.append(btn);
    return div;
  });
}

map.fitBounds(L.latLng(cossonay.lat, cossonay.lon).toBounds(radiusKm * 2000), {animate: false});
```

```js
// Liste des sites : cartes lisibles sur smartphone
const tri = [...validPoints].sort((a, b) => haversineDistance(cossonay, a) - haversineDistance(cossonay, b));

display(html`<div style="display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); margin-top: 16px;">
  ${tri.map(p => html`<div style="border: 1px solid var(--theme-foreground-faintest); border-radius: 8px; padding: 8px 12px;">
    <strong>${p.name}</strong><br>
    <span style="color: var(--theme-foreground-muted); font-size: 13px;">${p.type} · ${haversineDistance(cossonay, p).toFixed(1)} km · dénivelé ${p.denivele != null ? Math.round(p.denivele) + " m" : "?"}</span><br>
    <small>${p.tourism}</small>
  </div>`)}
</div>`);

if (ecartes.length) display(html`<details style="margin-top: 16px;"><summary>${ecartes.length} site(s) écarté(s) pour dénivelé supérieur à ${denivMax} m</summary>
  <ul>${ecartes.map(p => html`<li>${p.name} : ${Math.round(p.denivele)} m</li>`)}</ul></details>`);

display(html`<p style="color: var(--theme-foreground-muted); font-size: 12px;">
  ✈️ <strong>Note :</strong> les sites affichés respectent le seuil de dénivelé choisi. Le bouton de chaque fiche cherche des terrains d'au moins 1 hectare à proximité.
  <strong>À valider avec les propriétaires et autorités locales.</strong><br>
  Surfaces de biodiversité : source geodienste.ch, cantons / OFAG. Elles reflètent les déclarations agricoles, pas forcément l'état actuel des champs.
</p>`);
```

---

#### Erwan BOZEC - Philippe Riviere - Luc Léger - Aline Perdereau, Néguentropie
Copyleft: cette œuvre est libre, vous pouvez la copier, la diffuser et la modifier selon les termes de la [Licence Art Libre](http://www.artlibre.org)

<img src="artefacts-logo1.png" alt="Artefacts" width="150">

[https://artefacts.coop](https://artefacts.coop/)
