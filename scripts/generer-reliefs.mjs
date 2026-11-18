// Génère src/data/reliefs.json : altitude et dénivelé (swisstopo) de chaque site de la carte,
// sites choisis et aérodromes. Le data loader src/data/sites.json.js les lit au build ;
// il ne mesure lui-même que les sites absents du fichier (et le signale).
//
// À lancer après chaque modification de sites-manuels.json ou de aerodromes.json :
//   npm run reliefs            (ne mesure que les sites qui manquent)
//   npm run reliefs -- --tout  (remesure tout)

import {readFileSync, writeFileSync, existsSync} from "node:fs";
import {mesurerRelief, cleSite, pool} from "./relief.mjs";

const racine = new URL("../", import.meta.url);
const lire = f => JSON.parse(readFileSync(new URL(f, racine), "utf8"));
const sortie = new URL("src/data/reliefs.json", racine);

const sites = [...lire("src/data/sites-manuels.json"), ...lire("src/data/aerodromes.json")];
const avant = !process.argv.includes("--tout") && existsSync(sortie) ? lire("src/data/reliefs.json") : {};
const aMesurer = sites.filter(s => !(cleSite(s) in avant));
console.log(`${aMesurer.length} site(s) à mesurer sur ${sites.length}`);

const mesures = await pool(aMesurer, mesurerRelief);
const echecs = aMesurer.filter((s, i) => !mesures[i]).map(s => s.name);
const nouveau = Object.fromEntries(aMesurer.map((s, i) => [cleSite(s), mesures[i]]).filter(([, m]) => m));

// On ne garde que les sites encore présents, dans l'ordre de la carte
const reliefs = Object.fromEntries(sites.map(cleSite).filter(k => k in avant || k in nouveau)
  .map(k => [k, nouveau[k] ?? avant[k]]));
writeFileSync(sortie, JSON.stringify(reliefs, null, 1) + "\n");
console.log(`${Object.keys(reliefs).length} reliefs enregistrés dans src/data/reliefs.json`);
if (echecs.length) { console.error("Mesure impossible (relancer plus tard) :", echecs.join(", ")); process.exit(1); }
