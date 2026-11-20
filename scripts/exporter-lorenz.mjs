// Exporte le graphique Lorenz (état final de l'animation) en PNG :
// - src/lorenz-fediverse.png, 2000 × 1000 px, pour l'accueil ;
// - src/partage-lorenz.png, 1200 × 630 px, vignette de partage sur les réseaux
//   (Open Graph), avec une bande de fond gris en haut et en bas.
// Nécessite rsvg-convert (brew install librsvg).
//   npm run lorenz-png
// Le module src/graphiques/lorenz.js est exécuté tel quel avec un mini-DOM.
import {readFileSync, writeFileSync, mkdtempSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join} from "node:path";

const racine = new URL("..", import.meta.url).pathname;
const modulePath = join(racine, "src/graphiques/lorenz.js");
const dataPath = join(racine, "src/data/airocean-triangles.json");
const sortie = join(racine, "src/lorenz-fediverse.png");
const sortiePartage = join(racine, "src/partage-lorenz.png");

const echappe = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
class Element {
  constructor(nom) { Object.assign(this, {nom, attributs: {}, enfants: [], style: {}, textContent: "", isConnected: true}); }
  setAttribute(k, v) { this.attributs[k] = v; }
  removeAttribute(k) { delete this.attributs[k]; }
  append(e) { this.enfants.push(e); }
  get firstChild() { return this.enfants[0]; }
  toString() {
    const a = Object.entries(this.attributs).map(([k, v]) => ` ${k}="${echappe(v)}"`).join("");
    const s = this.style.cssText ? ` style="${echappe(this.style.cssText)}"` : "";
    return `<${this.nom}${a}${s}>${echappe(this.textContent)}${this.enfants.join("")}</${this.nom}>`;
  }
}
globalThis.document = {createElementNS: (_, nom) => new Element(nom)};
globalThis.__fichier = () => ({json: async () => JSON.parse(readFileSync(dataPath, "utf8"))});

const source = readFileSync(modulePath, "utf8")
  .replace(/import \{FileAttachment\} from "observablehq:stdlib";/, "const FileAttachment = globalThis.__fichier;")
  .replace("setTimeout(resolve, ms)", "setTimeout(resolve, 0)"); // pas d'animation
const {lorenz} = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const svg = await lorenz();
while (!svg.enfants.some((e) => e.attributs.id === "attracteur")) await new Promise((r) => setTimeout(r, 10));
svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

const svgPath = join(mkdtempSync(join(tmpdir(), "lorenz-")), "lorenz.svg");
writeFileSync(svgPath, svg.toString());
const rendre = (args) => execFileSync("rsvg-convert", ["-b", "#565656", ...args], {stdio: ["ignore", "ignore", "ignore"]});
writeFileSync(svgPath, svg.toString());
rendre(["-w", "2000", svgPath, "-o", sortie]);
console.log("Écrit :", sortie);

// Vignette 1200 × 630 (rapport 1,905) : on élargit la boîte de vue en hauteur (1000 × 525)
const largeur = 1000, hauteur = 500, hauteurPartage = largeur * 630 / 1200;
svg.setAttribute("viewBox", `0 ${-(hauteurPartage - hauteur) / 2} ${largeur} ${hauteurPartage}`);
writeFileSync(svgPath, svg.toString());
rendre(["-w", "1200", "-h", "630", svgPath, "-o", sortiePartage]);
console.log("Écrit :", sortiePartage);
