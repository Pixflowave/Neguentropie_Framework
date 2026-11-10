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

Carte des sites prestigieux autour de **Cossonay-Ville (Suisse)**. Réglez le rayon avec le curseur.

*Critères : Intérêt touristique prestigieux pour la clientèle | Surface >= 1 hectare*

```js
// Données fixes (calculées une seule fois)
const cossonay = {lon: 6.5075, lat: 46.6202, name: "Cossonay-Ville", type: "Centre"};

// Superficies et prestige : valeurs indicatives, à valider
const landingPoints = [
  {lon: 6.6323, lat: 46.5197, name: "Lausanne - Ouchy", type: "Lac + Ville", area: 5, prestige: 5, tourism: "Lac Léman, vue Alpes"},
  {lon: 6.9275, lat: 46.4116, name: "Château de Chillon", type: "Patrimoine UNESCO", area: 3, prestige: 5, tourism: "Château médiéval"},
  {lon: 6.8358, lat: 46.4750, name: "Vevey - Riviera", type: "Lac + Culture", area: 8, prestige: 5, tourism: "Chaplin's World, Nestlé"},
  {lon: 6.9153, lat: 46.4806, name: "Montreux - Château", type: "Lac + Montagne", area: 10, prestige: 5, tourism: "Jazz Festival, vue Lavaux"},
  {lon: 6.2562, lat: 46.2362, name: "Jussy - Chateaux du Crest", type: "Vignoble", area: 20, prestige: 4, tourism: "Vignobles, Vue Chateaux"},
  {lon: 6.6398, lat: 46.7781, name: "Yverdon-les-Bains", type: "Thermal + Nature", area: 15, prestige: 4, tourism: "Thermes, parc naturel"},
  {lon: 6.1376, lat: 46.3575, name: "Nyon - Domaine de Divonne", type: "Lac + Golf", area: 20, prestige: 4, tourism: "Golf, lac, vue Jura"},
  {lon: 6.1432, lat: 46.2044, name: "Genève - Aéroport", type: "International", area: 50, prestige: 5, tourism: "Ville internationale, Jet d'Eau"},
  {lon: 6.5800, lat: 46.6500, name: "Penthalaz - Domaine", type: "Campagne", area: 25, prestige: 3, tourism: "Vues panoramiques, calme"},
  {lon: 6.7000, lat: 46.5500, name: "Ecublens - Parc", type: "Innovation", area: 8, prestige: 4, tourism: "EPFL, lac proche"},

  // Sites ajoutés (coordonnées approximatives, superficies à valider)
  {lon: 6.5111, lat: 46.6567, name: "La Sarraz - Château", type: "Château", area: 4, prestige: 3, tourism: "Château, musée du cheval"},
  {lon: 6.7311, lat: 46.4880, name: "Cully - Lavaux", type: "Vignoble", area: 10, prestige: 5, tourism: "Vignoble en terrasses, UNESCO"},
  {lon: 6.3415, lat: 46.4588, name: "Rolle - Château", type: "Château", area: 3, prestige: 4, tourism: "Château au bord du lac"},
  {lon: 6.6469, lat: 46.8089, name: "Grandson - Château", type: "Château", area: 5, prestige: 4, tourism: "Château, lac de Neuchâtel"},
  {lon: 6.5000, lat: 46.8222, name: "Sainte-Croix", type: "Jura", area: 15, prestige: 3, tourism: "Balcons du Jura, vue Alpes"},
  {lon: 6.8478, lat: 46.8500, name: "Estavayer-le-Lac", type: "Lac + Ville", area: 6, prestige: 4, tourism: "Vieille ville, château de Chenaux"},
  {lon: 7.0833, lat: 46.5833, name: "Gruyères", type: "Château", area: 8, prestige: 5, tourism: "Château, village médiéval"},
  {lon: 7.1389, lat: 46.4764, name: "Château-d'Œx", type: "Montagne + Ballons", area: 20, prestige: 5, tourism: "Capitale des ballons, Alpes vaudoises"},
  {lon: 7.0425, lat: 46.8804, name: "Avenches", type: "Patrimoine romain", area: 12, prestige: 4, tourism: "Site romain, plaine de la Broye"},
  {lon: 6.9313, lat: 46.9920, name: "Neuchâtel", type: "Lac + Ville", area: 8, prestige: 4, tourism: "Lac, château, vieille ville"},
  {lon: 7.1613, lat: 46.8065, name: "Fribourg", type: "Ville historique", area: 10, prestige: 4, tourism: "Vieille ville, cathédrale"},
  {lon: 7.1136, lat: 46.9269, name: "Morat", type: "Lac + Ville", area: 7, prestige: 4, tourism: "Ville fortifiée, lac de Morat"},
  {lon: 7.2861, lat: 46.4749, name: "Gstaad", type: "Montagne + Ballons", area: 18, prestige: 5, tourism: "Station alpine de prestige"},
  {lon: 7.4474, lat: 46.9480, name: "Berne", type: "Ville historique", area: 15, prestige: 5, tourism: "Vieille ville UNESCO, Alpes"},
  {lon: 7.4739, lat: 46.9492, name: "Zentrum Paul Klee (Berne)", type: "Musée + parc", area: 9, prestige: 5, tourism: "Musée de Renzo Piano, parc de sculptures"},
  {lon: 6.2516, lat: 46.3942, name: "Château de Prangins (Musée national)", type: "Musée + parc", area: 5, prestige: 4, tourism: "Château du XVIIIe siècle, jardins, vue sur le Léman"}
];

// Suivi des parcelles voisines : statuts uniquement, SANS nom ni téléphone
// (la page est publique sur GitHub Pages)
const suivi = {
  "Penthalaz - Domaine": {parcelle: "à repérer", accord: "à contacter"}
  // "Nom du site": {parcelle: "...", accord: "à contacter | contacté | accord | refus"}
};

function haversineDistance(coord1, coord2) {
  const R = 6371;
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLon = (coord2.lon - coord1.lon) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
            Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Couleurs générées automatiquement selon les types présents
const types = [...new Set(landingPoints.map(p => p.type))];
const colorScale = d3.scaleOrdinal(types, d3.quantize(t => d3.interpolateRainbow(t * 0.9), types.length));
```

```js
const radiusKm = view(Inputs.range([10, 100], {value: 60, step: 5, label: "Rayon (km)"}));
```

```js
// Ce bloc se recalcule à chaque changement du curseur
const validPoints = landingPoints.filter(p => haversineDistance(cossonay, p) <= radiusKm);

display(html`<p><strong>${validPoints.length} site${validPoints.length > 1 ? "s" : ""}</strong> dans un rayon de ${radiusKm} km autour de ${cossonay.name}.</p>`);

const mapDiv = display(document.createElement("div"));
mapDiv.style = "height: 600px; width: 100%; border-radius: 8px;";

const map = L.map(mapDiv, {
  zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
  wheelPxPerZoomLevel: 240,  // 60 par défaut : plus la valeur est grande, moins le zoom est sensible
  wheelDebounceTime: 60,     // regroupe les mouvements rapprochés de la molette
  zoomSnap: 0.5              // le zoom avance par demi-niveau au lieu d'un niveau entier
}).setView([cossonay.lat, cossonay.lon], 9);
let alive = true;
invalidation.then(() => { alive = false; map.remove(); });

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20, maxNativeZoom: 19, zIndex: 1,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Vue satellite (swisstopo SWISSIMAGE, Suisse uniquement)
const satellite = L.tileLayer("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg", {
  maxZoom: 20, maxNativeZoom: 20, zIndex: 2,
  attribution: "&copy; swisstopo"
}).addTo(map);

// Couches de biodiversité (geodienste.ch)
const wmsUrl = "https://wfs.geodienste.ch/lwb_biodiversitaetsfoerderflaechen_v2_0_0/fra";
const wmsOpts = {format: "image/png", transparent: true, opacity: 0.65, zIndex: 3,
  attribution: "Source : geodienste.ch, cantons / OFAG"};
const spbQ2 = L.tileLayer.wms(wmsUrl, {...wmsOpts, layers: "spb_qualite_2_surfaces"});
const spbReseau = L.tileLayer.wms(wmsUrl, {...wmsOpts, layers: "spb_reseau_surfaces"});
const dispo = L.tileLayer.wms(wmsUrl, {...wmsOpts, layers: "disponibilite_cantons", opacity: 0.5, zIndex: 4});

L.control.layers(null, {
  "Vue satellite (swisstopo)": satellite,
  "SPB qualité II (jachères, prairies…)": spbQ2,
  "SPB mises en réseau (zoom requis)": spbReseau,
  "Disponibilité des données par canton": dispo
}, {collapsed: false}).addTo(map);

// Cercle du rayon
L.circle([cossonay.lat, cossonay.lon], {
  radius: radiusKm * 1000, color: "#ff0000", weight: 2, dashArray: "6 6", fillOpacity: 0.03,
  interactive: false
}).addTo(map);

// Centre
L.circleMarker([cossonay.lat, cossonay.lon], {
  radius: 9, color: "#fff", weight: 2, fillColor: "#ff0000", fillOpacity: 1,
  bubblingMouseEvents: false
}).addTo(map).bindTooltip(cossonay.name, {permanent: true, direction: "right"});

// Sites
for (const p of validPoints) {
  const s = suivi[p.name];
  L.circleMarker([p.lat, p.lon], {
    radius: 5 + Math.sqrt(p.area),
    color: "#fff", weight: 1.5, fillColor: colorScale(p.type), fillOpacity: 0.9,
    bubblingMouseEvents: false
  })
  .addTo(map)
  .bindTooltip(p.name, {direction: "top"})
  .bindPopup(`<strong>${p.name}</strong><br>${p.type} · ${p.area} ha <small>(${p.source ?? "estimation à vérifier"})</small><br>${p.tourism}<br>${haversineDistance(cossonay, p).toFixed(1)} km de Cossonay${s ? `<br><em>Parcelle : ${s.parcelle} · Accord : ${s.accord}</em>` : ""}`);
}

// Légende des types de sites
const legend = L.control({position: "bottomright"});
legend.onAdd = () => {
  const div = L.DomUtil.create("div");
  div.style.cssText = "background:#fff;color:#333;padding:8px 10px;border-radius:6px;font-size:12px;line-height:1.7;box-shadow:0 1px 4px rgba(0,0,0,.3)";
  const used = [...new Set(validPoints.map(p => p.type))];
  div.innerHTML = "<strong>Type de site</strong><br>" + used.map(t =>
    `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorScale(t)};margin-right:6px"></span>${t}`
  ).join("<br>");
  return div;
};
legend.addTo(map);

// Clic sur la carte : type de surface de biodiversité (GetFeatureInfo)
const codesSPB = {
  "556": "Jachère florale", "557": "Jachère tournante", "559": "Ourlet sur terre assolée",
  "572": "Bande fleurie pour pollinisateurs",
  "611": "Prairie extensive", "612": "Prairie peu intensive",
  "617": "Pâturage extensif", "618": "Pâturage boisé",
  "622": "Prairie extensive (estivage)", "623": "Prairie peu intensive (estivage)",
  "634": "Prairie riveraine d'un cours d'eau"
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
    const label = codesSPB[code] ?? (code ? `Code ${code}` : "Surface de biodiversité");
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

map.fitBounds(L.latLng(cossonay.lat, cossonay.lon).toBounds(radiusKm * 2000), {animate: false});

// Tableau des sites, avec suivi
const tableData = validPoints.map(p => ({
  Site: p.name,
  Type: p.type,
  "Superficie (ha)": p.area,
  "Source superficie": p.source ?? "estimation à vérifier",
  "Prestige": "★".repeat(p.prestige),
  "Distance (km)": +haversineDistance(cossonay, p).toFixed(1),
  "Parcelle proche": suivi[p.name]?.parcelle ?? "—",
  "Accord": suivi[p.name]?.accord ?? "—",
  "Intérêt touristique": p.tourism
})).sort((a, b) => a["Distance (km)"] - b["Distance (km)"]);

display(Inputs.table(tableData, {rows: 12})); 

display(html`<p style="color: var(--theme-foreground-muted); font-size: 12px;">
  ✈️ <strong>Note :</strong> les points marqués sur la carte respectent les critères :
  <em>intérêt touristique prestigieux pour la clientèle des Ballons du Léman</em> et
  <em>surface minimale de 1 hectare</em>.
  <strong>À valider avec les propriétaires et autorités locales.</strong><br>
  Surfaces de biodiversité : source geodienste.ch, cantons / OFAG. Elles reflètent les déclarations agricoles, pas forcément l'état actuel des champs.
</p>`);
```

---

#### Erwan BOZEC - Philippe Riviere - Luc Léger - Aline Perdereau, Néguentropie
Copyleft: cette œuvre est libre, vous pouvez la copier, la diffuser et la modifier selon les termes de la [Licence Art Libre](http://www.artlibre.org)

<img src="artefacts-logo1.png" alt="Artefacts" width="150">

[https://artefacts.coop](https://artefacts.coop/)
