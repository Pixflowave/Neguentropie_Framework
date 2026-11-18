// Données OpenStreetMap du projet : une bibliothèque GeoDesk locale (donnees-osm/romandie.gol),
// interrogée avec l'outil `gol` (https://www.geodesk.com/download, binaire autonome).
// Elle est chargée depuis le fichier planète d'openplanetdata.com : seules les tuiles de la
// zone utile sont téléchargées (quelques centaines de Mo, quelques secondes).
//
//   npm run osm     (re)charge la bibliothèque — environ une fois par an, ou quand la zone change
//                   (nouveau site, rayon des aérodromes modifié). Hors bac à sable : `gol` ignore
//                   les proxys HTTP.
// Variable GOL : chemin de l'outil gol s'il n'est pas dans le PATH.
// Ce module sert aussi aux scripts generer-terrains.mjs et generer-aerodromes.mjs.

import {readFileSync, writeFileSync, existsSync, mkdirSync, rmSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

export const racine = new URL("../", import.meta.url);
const GOL = process.env.GOL || "gol";
const dossier = fileURLToPath(new URL("donnees-osm/", racine));
const bibliotheque = dossier + "romandie.gol";
const fichierZone = dossier + "zone.json";
const PLANETE = "https://download.openplanetdata.com/osm/planet/gob/v1/planet-latest.osm.gob";

export const COSSONAY = {lon: 6.5075, lat: 46.6202};
export const RAYON_AERODROMES = 100_000;   // mètres autour de Cossonay
const MARGE_SITES = 0.04;                  // degrés autour des sites choisis (≥ 2 km des terrains)

export const R = 6371000;
export const rad = d => d * Math.PI / 180;

// Zone à charger : sites choisis (avec marge) + cercle des aérodromes, en [O, S, E, N]
export function zoneVoulue() {
  const sites = JSON.parse(readFileSync(new URL("src/data/sites-manuels.json", racine), "utf8"));
  const dLat = RAYON_AERODROMES / R * 180 / Math.PI, dLon = dLat / Math.cos(rad(COSSONAY.lat));
  const lon = [...sites.map(s => s.lon), COSSONAY.lon], lat = [...sites.map(s => s.lat), COSSONAY.lat];
  return [
    Math.min(Math.min(...lon) - MARGE_SITES, COSSONAY.lon - dLon), Math.min(Math.min(...lat) - MARGE_SITES, COSSONAY.lat - dLat),
    Math.max(Math.max(...lon) + MARGE_SITES, COSSONAY.lon + dLon), Math.max(Math.max(...lat) + MARGE_SITES, COSSONAY.lat + dLat)
  ].map((v, i) => i < 2 ? Math.floor(v * 1000) / 1000 : Math.ceil(v * 1000) / 1000);
}

export function gol(...a) {
  try {
    return execFileSync(GOL, a, {encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "inherit"]});
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`Outil « ${GOL} » introuvable : le télécharger sur https://www.geodesk.com/download,\n` +
                    "puis le mettre dans le PATH ou indiquer son chemin dans la variable GOL.");
      process.exit(1);
    }
    throw err;
  }
}

export function charger() {
  const zone = zoneVoulue().join(",");
  console.log(`Chargement des données OSM (zone ${zone}) depuis openplanetdata.com…`);
  rmSync(bibliotheque, {force: true});
  mkdirSync(dossier, {recursive: true});
  gol("load", bibliotheque, PLANETE, "-b", zone);
  writeFileSync(fichierZone, JSON.stringify(zoneVoulue()));
}

// Vérifie que la bibliothèque existe et couvre la zone voulue ; renvoie la date des données
export function verifier() {
  const [o, s, e, n] = zoneVoulue();
  const z = existsSync(fichierZone) ? JSON.parse(readFileSync(fichierZone, "utf8")) : null;
  if (!existsSync(bibliotheque) || !z || o < z[0] || s < z[1] || e > z[2] || n > z[3]) {
    console.error("La bibliothèque OSM manque ou ne couvre pas toute la zone (nouveau site ?).\n" +
                  "Lancer d'abord, dans un terminal ordinaire :  npm run osm");
    process.exit(1);
  }
  const date = gol("info", bibliotheque).match(/Revision:.*?(\d{4}-\d\d-\d\d)/)?.[1] ?? null;
  console.log(`Données OSM du ${date ?? "?"}`);
  return date;
}

// Cercle en polygone de 64 points « lon,lat,… » pour l'option -a de gol
// (gol renvoie les objets qui le touchent, même en partie, comme around: d'Overpass)
export function cercle({lat, lon}, rayon) {
  const pts = [];
  for (let i = 0; i < 64; i++) {
    const t = 2 * Math.PI * i / 64;
    pts.push((lon + rayon * Math.sin(t) / (R * Math.cos(rad(lat))) * 180 / Math.PI).toFixed(6),
             (lat + rayon * Math.cos(t) / R * 180 / Math.PI).toFixed(6));
  }
  return pts.join(",");
}

// Requête GOQL dans un cercle → objets GeoJSON
export function requete(goql, centre, rayon, cles, precision = 7) {
  return gol("query", bibliotheque, goql, "-a", cercle(centre, rayon), "-f", "geojsonl",
             "-k", cles, "-p", String(precision), "-q")
    .split("\n").filter(Boolean).map(l => JSON.parse(l));
}

if (import.meta.url === `file://${process.argv[1]}`) charger();
