// Tests du convertisseur bibliographique (cas de audit-convertisseur/CLAUDE.md).
// Lancer : npm run test:convertisseur   (aucune requête réseau)

import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mergeCSL, titreNoeud, annee, trouverPersonne} from "../src/components/fusion-csl.js";
import {cleanTitle, auteurCorrespond} from "../src/components/bibliography-verifier.js";

const graphe = JSON.parse(readFileSync(new URL("../src/data/neguentropie_Graph.json", import.meta.url)));
let echecs = 0;
function test(nom, f) {
  try { f(); console.log("✓", nom); }
  catch (e) { echecs++; console.log("✗", nom, "\n  ", e.message.split("\n").join("\n   ")); }
}
const fusion = (csl, verifs = [], completer = true) => {
  const r = mergeCSL(JSON.stringify(csl), graphe, "Technè", verifs, completer);
  return {...r, nouveaux: r.nodes.slice(graphe.nodes.length).map((n) => n.id), aretes: r.edges.slice(graphe.edges.length)};
};
const livre = (title, family, given, an) => ({title, type: "book", author: [{family, given}], ...(an ? {issued: {"date-parts": [[an]]}} : {})});

// 1. Un résultat incertain ne remplace rien
test("1. résultat incertain (22 %) : données d'origine conservées", () => {
  const r = fusion([livre("Le capital au XXIe siècle", "Piketty", "Thomas", 2013)],
    [{status: "uncertain", verified: {title: "Capitalism and Freedom", author: "Milton Friedman", year: 1962, url: "https://x", confidence: 22, found: true}}]);
  assert.deepEqual(r.nouveaux, ["Le capital au XXIe siècle"]); // Thomas Piketty est déjà dans le graphe
  assert.ok(r.aretes.some((e) => e.source === "Thomas Piketty" && e.target === "Le capital au XXIe siècle"));
  assert.ok(!r.nouveaux.includes("Milton Friedman"));
  assert.equal(r.rapport.completees.length, 0);
});
test("1. résultat vérifié : complète seulement ce qui manque", () => {
  const r = fusion([{title: "La société automatique. 1, L'avenir du travail", author: [{family: "Stiegler", given: "Bernard"}]}],
    [{status: "verified", verified: {title: "La société automatique / Bernard Stiegler", author: "Stiegler, Bernard", year: "DL 2015", url: "https://catalogue.bnf.fr/ark:/12148/cb1", confidence: 90, source: "BnF (SRU)"}}]);
  const n = r.nodes.find((x) => x.id === "La société automatique. 1, L'avenir du travail");
  assert.ok(n, "titre d'origine gardé");
  assert.equal(n.year, 2015);
  assert.equal(n.url, "https://catalogue.bnf.fr/ark:/12148/cb1");
  assert.equal(r.rapport.completees[0].champs, "adresse, année");
});
test("1. l'auteur doit correspondre", () => {
  assert.equal(auteurCorrespond("Thomas Piketty", "Milton Friedman"), false);
  assert.equal(auteurCorrespond("Bernard Stiegler", "Stiegler, Bernard"), true);
  assert.equal(auteurCorrespond("Simone de Beauvoir", "Beauvoir, Simone de"), true);
  assert.equal(auteurCorrespond("", "Milton Friedman"), null);
  assert.equal(auteurCorrespond("Bernard Stiegler", ""), null);
});

// 2. Titre complet comme identifiant
test("2. tomes 2 et 3 restent deux nœuds", () => {
  const r = fusion([livre("La technique et le temps, tome 2", "Stiegler", "Bernard", 1996), livre("La technique et le temps, tome 3", "Stiegler", "Bernard", 2001)]);
  assert.ok(r.nouveaux.includes("La technique et le temps, tome 2"));
  assert.ok(r.nouveaux.includes("La technique et le temps, tome 3"));
});
test("2. sous-titre gardé, nom d'auteur collé retiré", () => {
  assert.equal(titreNoeud("Capital: Critique of Political Economy", [{family: "Marx", given: "Karl"}]), "Capital: Critique of Political Economy");
  assert.equal(titreNoeud("Condition de l'homme moderne, Hannah Arendt", [{family: "Arendt", given: "Hannah"}]), "Condition de l'homme moderne");
  assert.equal(cleanTitle("Capital: Critique of Political Economy"), "Capital", "la recherche, elle, simplifie toujours");
});
test("2. année en nombre", () => {
  assert.equal(annee("DL 2015"), 2015);
  assert.equal(annee(1962), 1962);
  assert.equal(annee("s.d."), null);
});

// 3. Rien n'est écarté sans le dire
test("3. « Silent Spring » sans année ni adresse est gardé, avec un avertissement", () => {
  const r = fusion([livre("Silent Spring", "Carson", "Rachel")]);
  assert.ok(r.nouveaux.includes("Silent Spring"));
  assert.equal(r.rapport.avertissements.length, 1);
});
test("3. les entrées écartées sont listées avec leur raison", () => {
  const r = fusion([null, {author: [{family: "Dupont", given: "Jean"}]}, livre("Jean Dupont", "Dupont", "Jean")]);
  assert.deepEqual(r.rapport.ecartees.map((e) => e.n), [1, 2, 3]);
});
test("3. JSON qui n'est pas une liste : message clair", () => {
  const r = mergeCSL('{"title": "x"}', graphe, null);
  assert.match(r.error, /liste/);
});

// 4. Rapprochements
test("4. « P. Stiegler » n'est pas rattaché à « Penser avec Bernard Stiegler »", () => {
  const r = fusion([livre("Un livre de Pierre", "Stiegler", "P.", 2021)]);
  assert.ok(!r.aretes.some((e) => e.source === "Penser avec Bernard Stiegler"));
  assert.ok(r.nouveaux.includes("P. Stiegler"));
});
test("4. « B. Stiegler » est rapproché de Bernard Stiegler, et le rapprochement est signalé", () => {
  const r = fusion([livre("Test homonyme", "Stiegler", "B.", 2020)]);
  assert.ok(r.aretes.some((e) => e.source === "Bernard Stiegler" && e.target === "Test homonyme"));
  assert.equal(r.rapport.rapprochements[0].noeud, "Bernard Stiegler");
});
test("4. casse différente : nœud existant réutilisé", () => {
  const r = fusion([livre("La Gouvernance par les nombres", "Supiot", "Alain", 2015)]);
  assert.deepEqual(r.nouveaux, []);
  assert.ok(r.rapport.rapprochements.some((x) => x.noeud === "La gouvernance par les nombres"));
});
test("4. initiale ambiguë : pas de choix, avertissement", () => {
  const ids = new Set(["Bernard Stiegler", "Barbara Stiegler"]);
  assert.deepEqual(trouverPersonne("B. Stiegler", ids, ids), {ambigu: ["Bernard Stiegler", "Barbara Stiegler"]});
});
test("le graphe d'origine n'est pas modifié", () => {
  const avant = JSON.stringify(graphe);
  fusion([livre("Un autre livre", "Durand", "Paul", 2000)]);
  assert.equal(JSON.stringify(graphe), avant);
});

// verifyEntry avec de fausses réponses de catalogue (pas de réseau).
// Open Library renvoie le bon titre, mais selon le cas le bon ou un autre auteur.
async function verifierAvec(auteurCatalogue) {
  const vide = {docs: [], response: {docs: []}, message: {items: []}, results: {bindings: []}};
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () => String(url).includes("openlibrary.org")
      ? {docs: [{title: "Le capital au XXIe siècle", author_name: [auteurCatalogue], key: "/works/OL1W"}]}
      : String(url).includes("openalex") ? {results: []} : vide,
    text: async () => "<x/>"
  });
  return verifyEntry({title: "Le capital au XXIe siècle", author: "Thomas Piketty"});
}
const {verifyEntry} = await import("../src/components/bibliography-verifier.js");
const console0 = {...console};
console.error = console.warn = console.log = () => {};
const memeAuteur = await verifierAvec("Thomas Piketty");
const autreAuteur = await verifierAvec("Milton Friedman");
Object.assign(console, console0);
test("1. verifyEntry : même titre, même auteur → vérifié", () => {
  assert.equal(memeAuteur.status, "verified");
  assert.equal(memeAuteur.verified.authorMatch, true);
});
test("1. verifyEntry : même titre, autre auteur → incertain", () => {
  assert.equal(autreAuteur.status, "uncertain");
  assert.equal(autreAuteur.verified.authorMatch, false);
});

console.log(echecs ?`\n${echecs} test(s) en échec` : "\nTous les tests passent");
process.exit(echecs ? 1 : 0);
