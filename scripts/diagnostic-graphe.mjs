// Diagnostic de src/data/neguentropie_Graph.json. Ne modifie rien.
// Lancer : npm run diagnostic:graphe   (ajouter -- --json pour une sortie JSON)

import {readFileSync} from "node:fs";
import {normaliserTexte} from "../src/components/bibliography-verifier.js";
import {titreProche} from "../src/components/fusion-csl.js";

const fichier = new URL("../src/data/neguentropie_Graph.json", import.meta.url);
const g = JSON.parse(readFileSync(fichier, "utf8"));
const ids = g.nodes.map((n) => n.id);
const existe = new Set(ids);

const compter = (liste) => liste.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
const deg = compter(g.edges.flatMap((e) => [e.source, e.target]));

// 1. Identifiants en double
const idsEnDouble = [...compter(ids)].filter(([, k]) => k > 1).map(([id, k]) => ({
  id, fois: k, versions: g.nodes.filter((n) => n.id === id).map(({id: _, ...reste}) => reste)
}));

// 2. Arêtes en double (même source, même cible, même type) et paires reliées deux fois avec des types différents
const cle = (e) => `${e.source}\u0000${e.target}`;
const aretesEnDouble = [...compter(g.edges.map((e) => `${cle(e)}\u0000${e.type}`))].filter(([, k]) => k > 1)
  .map(([c, k]) => { const [source, target, type] = c.split("\u0000"); return {source, target, type, fois: k}; });
const typesMultiples = [...compter(g.edges.map(cle))].filter(([, k]) => k > 1)
  .map(([c]) => { const [source, target] = c.split("\u0000"); return {source, target, types: g.edges.filter((e) => e.source === source && e.target === target).map((e) => e.type)}; })
  .filter((x) => new Set(x.types).size > 1);

// 3. Arêtes vers des nœuds absents, avec le nœud existant le plus proche
const parNorme = new Map();
for (const id of existe) parNorme.set(normaliserTexte(id), id);
const pendantes = g.edges.filter((e) => !existe.has(e.source) || !existe.has(e.target)).map((e) => {
  const absent = existe.has(e.source) ? e.target : e.source;
  return {...e, absent, candidat: parNorme.get(normaliserTexte(absent)) ?? titreProche(absent, ids) ?? null};
});

// 4. Quasi-doublons : même texte à la casse, aux accents et à la ponctuation près
const groupes = new Map();
for (const id of new Set(ids)) {
  const k = normaliserTexte(id);
  if (!groupes.has(k)) groupes.set(k, []);
  groupes.get(k).push(id);
}
const quasiDoublons = [...groupes.values()].filter((v) => v.length > 1);

// 5. Titres proches (l'un commence par l'autre, ou presque mêmes mots)
const uniques = [...new Set(ids)];
const vus = new Set();
const titresProches = [];
for (const id of uniques) {
  const autre = titreProche(id, uniques.filter((x) => x !== id));
  if (!autre) continue;
  const paire = [id, autre].sort().join("\u0000");
  if (vus.has(paire) || normaliserTexte(id) === normaliserTexte(autre)) continue;
  vus.add(paire);
  titresProches.push([id, autre]);
}

// 6. Identifiants mal formés
const malFormes = uniques.map((id) => {
  const pb = [];
  if (id !== id.trim()) pb.push("espace au début ou à la fin");
  if (/\s{2,}/.test(id)) pb.push("espaces doubles");
  const ouv = (id.match(/\(/g) || []).length, fer = (id.match(/\)/g) || []).length;
  if (ouv !== fer) pb.push("parenthèses déséquilibrées");
  if ((id.match(/«/g) || []).length !== (id.match(/»/g) || []).length) pb.push("guillemets « » déséquilibrés");
  if (/[,;:]$/.test(id.trim())) pb.push("ponctuation finale");
  return pb.length ? {id, problemes: pb} : null;
}).filter(Boolean);

// 7. Personnes à initiale ou à orthographe voisine d'une autre
const personnes = uniques.filter((id) => /^[A-ZÀ-Ý]\.\s?-?[A-ZÀ-Ý]?\.?\s?[A-ZÀ-Ý]/.test(id) || /^\p{Lu}\p{Ll}+(?:[- ]\p{Lu}\p{Ll}+)?\s\p{Lu}\p{Ll}+$/u.test(id));
const sansAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L").toLowerCase();
const personnesVoisines = [];
for (let i = 0; i < personnes.length; i++) for (let j = i + 1; j < personnes.length; j++) {
  const a = personnes[i], b = personnes[j];
  const na = sansAccents(a).replace(/[^a-z]/g, ""), nb = sansAccents(b).replace(/[^a-z]/g, "");
  const nomA = sansAccents(a).split(/[\s.]+/).pop(), nomB = sansAccents(b).split(/[\s.]+/).pop();
  const initiale = /^[A-ZÀ-Ý]\./.test(a) !== /^[A-ZÀ-Ý]\./.test(b) && nomA === nomB && sansAccents(a)[0] === sansAccents(b)[0];
  const presque = na !== nb && Math.abs(na.length - nb.length) <= 1 && distance(na, nb) === 1 && nomA.length > 3;
  if (initiale || presque || (na === nb && a !== b)) personnesVoisines.push([a, b]);
}
function distance(a, b) {
  const d = Array.from({length: a.length + 1}, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// 8. Années : type et valeurs
const annees = g.nodes.filter((n) => "year" in n).map((n) => ({id: n.id, year: n.year, type: typeof n.year}));

// 9. Nœuds isolés et sans adresse
const isoles = uniques.filter((id) => !deg.get(id));
const sansUrl = g.nodes.filter((n) => !n.url).map((n) => n.id);

// 10. Types d'arêtes
const types = Object.fromEntries([...compter(g.edges.map((e) => e.type))].sort((a, b) => b[1] - a[1]));

const rapport = {
  resume: {noeuds: g.nodes.length, identifiantsUniques: uniques.length, aretes: g.edges.length},
  idsEnDouble, aretesEnDouble, typesMultiples, pendantes, quasiDoublons, titresProches, malFormes,
  personnesVoisines, annees, isoles, sansUrl, types
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rapport, null, 2));
} else {
  const titre = (t, n) => console.log(`\n## ${t} (${n})`);
  console.log("Graphe :", rapport.resume);
  titre("Identifiants en double", idsEnDouble.length);
  idsEnDouble.forEach((d) => console.log(`- « ${d.id} » ×${d.fois} :`, JSON.stringify(d.versions)));
  titre("Arêtes en double", aretesEnDouble.length);
  aretesEnDouble.forEach((e) => console.log(`- ${e.source} → ${e.target} [${e.type}] ×${e.fois}`));
  titre("Mêmes nœuds reliés deux fois avec des types différents", typesMultiples.length);
  typesMultiples.forEach((e) => console.log(`- ${e.source} → ${e.target} : ${e.types.join(", ")}`));
  titre("Arêtes vers un nœud absent", pendantes.length);
  pendantes.forEach((e) => console.log(`- ${e.source} → ${e.target} [${e.type}] : « ${e.absent} » absent${e.candidat ? ` — existant proche : « ${e.candidat} »` : ""}`));
  titre("Quasi-doublons (casse, accents, ponctuation)", quasiDoublons.length);
  quasiDoublons.forEach((v) => console.log(`- ${v.map((x) => `« ${x} » (${deg.get(x) || 0} arêtes)`).join(" / ")}`));
  titre("Titres proches", titresProches.length);
  titresProches.forEach(([a, b]) => console.log(`- « ${a} » / « ${b} »`));
  titre("Identifiants mal formés", malFormes.length);
  malFormes.forEach((m) => console.log(`- « ${m.id} » : ${m.problemes.join(", ")}`));
  titre("Personnes voisines (initiale, accent, une lettre)", personnesVoisines.length);
  personnesVoisines.forEach(([a, b]) => console.log(`- « ${a} » (${deg.get(a) || 0}) / « ${b} » (${deg.get(b) || 0})`));
  titre("Années", annees.length);
  annees.forEach((a) => console.log(`- « ${a.id} » : ${JSON.stringify(a.year)} (${a.type})`));
  titre("Nœuds isolés", isoles.length);
  isoles.forEach((x) => console.log(`- ${x}`));
  titre("Nœuds sans adresse", sansUrl.length);
  console.log(sansUrl.map((x) => `« ${x} »`).join(", "));
  titre("Types d'arêtes", Object.keys(types).length);
  console.log(types);
}
