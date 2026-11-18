import {readFileSync} from "node:fs";
import {mesurerRelief, cleSite, pool} from "../../scripts/relief.mjs";

// Sites choisis à la main (nom, coordonnées, type, intérêt touristique)
const manuels = JSON.parse(readFileSync(new URL("./sites-manuels.json", import.meta.url), "utf8"));

// Aérodromes à code OACI dans 100 km autour de Cossonay (OpenStreetMap), précalculés
// par  npm run aerodromes  depuis la bibliothèque GeoDesk locale : aucune requête Overpass au build.
const aerodromes = JSON.parse(readFileSync(new URL("./aerodromes.json", import.meta.url), "utf8"));

// Altitude et dénivelé de chaque site, précalculés par  npm run reliefs  (src/data/reliefs.json).
// Un site absent du fichier (ajouté depuis) est mesuré ici, auprès de swisstopo, et signalé.
const reliefs = JSON.parse(readFileSync(new URL("./reliefs.json", import.meta.url), "utf8"));

const sites = [...manuels, ...aerodromes];
const manquants = sites.filter(s => !(cleSite(s) in reliefs));
if (manquants.length) {
  console.error(`Reliefs manquants, mesurés au build (lancer npm run reliefs) : ${manquants.map(s => s.name).join(", ")}`);
  const mesures = await pool(manquants, s => mesurerRelief(s));
  manquants.forEach((s, i) => { if (mesures[i]) reliefs[cleSite(s)] = mesures[i]; });
}

process.stdout.write(JSON.stringify(sites.map(s => ({
  ...s,
  denivele: reliefs[cleSite(s)]?.denivele ?? null,
  altitude: reliefs[cleSite(s)]?.altitude ?? null
}))));
