// Exporte le graphique Lorenz (état final de l'animation) en PNG pour l'accueil :
// src/lorenz-fediverse.png, 2000 × 1000 px. Nécessite rsvg-convert (brew install librsvg).
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
execFileSync("rsvg-convert", ["-w", "2000", "-b", "#565656", svgPath, "-o", sortie], {stdio: ["ignore", "ignore", "ignore"]});
console.log("Écrit :", sortie);
