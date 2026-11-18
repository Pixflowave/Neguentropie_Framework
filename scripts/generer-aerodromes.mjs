// Génère src/data/aerodromes.json : les aérodromes à code OACI dans un rayon de 100 km
// autour de Cossonay, depuis la bibliothèque GeoDesk locale (voir scripts/osm.mjs).
// Le build les lit tel quel (src/data/sites.json.js) : plus aucune requête Overpass.
//
// À lancer à la main, environ une fois par an, après  npm run osm :  npm run aerodromes

import {writeFileSync} from "node:fs";
import {racine, verifier, requete, COSSONAY, RAYON_AERODROMES} from "./osm.mjs";

verifier();

// Point représentatif : le centre de l'emprise, comme `out center` d'Overpass
function centre(geom) {
  const pts = JSON.stringify(geom.coordinates).match(/-?[\d.]+,-?[\d.]+/g).map(p => p.split(",").map(Number));
  const lon = pts.map(p => p[0]), lat = pts.map(p => p[1]);
  return {lat: (Math.min(...lat) + Math.max(...lat)) / 2, lon: (Math.min(...lon) + Math.max(...lon)) / 2};
}

const aerodromes = requete("nwa[aeroway=aerodrome][icao]", COSSONAY, RAYON_AERODROMES, "name,icao")
  .map(f => {
    const {lat, lon} = centre(f.geometry);
    return {
      lat: Math.round(lat * 1e7) / 1e7, lon: Math.round(lon * 1e7) / 1e7,
      name: `${f.properties?.name ?? "Aérodrome"} (${f.properties.icao})`,
      type: "Aérodrome", tourism: "Décollage depuis l'aérodrome, avec l'accord du gestionnaire"
    };
  })
  .filter((a, i, tab) => tab.findIndex(t => t.name === a.name) === i)
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

writeFileSync(new URL("src/data/aerodromes.json", racine), JSON.stringify(aerodromes, null, 1) + "\n");
console.log(`${aerodromes.length} aérodromes enregistrés dans src/data/aerodromes.json`);
