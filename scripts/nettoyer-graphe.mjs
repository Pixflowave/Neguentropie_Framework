// Nettoyage de src/data/neguentropie_Graph.json (décisions d'Erwan, 2026-11-20).
// Sans option : affiche ce qui serait fait, ne modifie rien.
//   node scripts/nettoyer-graphe.mjs --appliquer   → écrit le fichier
// Le script peut être relancé : une opération déjà faite ne change plus rien.
// Diagnostic avant/après : npm run diagnostic:graphe

import {readFileSync, writeFileSync} from "node:fs";
import {normaliserTexte} from "../src/components/bibliography-verifier.js";

const fichier = new URL("../src/data/neguentropie_Graph.json", import.meta.url);
const g = JSON.parse(readFileSync(fichier, "utf8"));
const journal = [];
const note = (s) => journal.push(s);
const avant = {noeuds: g.nodes.length, aretes: g.edges.length};

const noeud = (id) => g.nodes.find((n) => n.id === id);

/**
 * Renomme un nœud (et ses arêtes). Si `nouveau` existe déjà, fusionne :
 * l'adresse non vide et l'année sont gardées, `champs` l'emporte.
 */
function renommer(ancien, nouveau, champs = {}) {
  const a = g.nodes.filter((n) => n.id === ancien);
  const aretes = g.edges.filter((e) => e.source === ancien || e.target === ancien);
  if (!a.length && !aretes.length) return;
  const cible = ancien === nouveau ? null : noeud(nouveau);
  if (cible) {
    for (const n of a) {
      if (!cible.url && n.url) cible.url = n.url;
      if (cible.year == null && n.year != null) cible.year = n.year;
    }
    g.nodes = g.nodes.filter((n) => n.id !== ancien);
    note(`fusion : « ${ancien} » → « ${nouveau} » (${aretes.length} arêtes déplacées)`);
  } else if (a.length) {
    a.forEach((n) => { n.id = nouveau; });
    if (ancien !== nouveau) note(`renommé : « ${ancien} » → « ${nouveau} » (${aretes.length} arêtes)`);
  } else {
    note(`arêtes raccrochées : « ${ancien} » (absent) → « ${nouveau} » (${aretes.length})`);
  }
  for (const e of aretes) {
    if (e.source === ancien) e.source = nouveau;
    if (e.target === ancien) e.target = nouveau;
  }
  const n = noeud(nouveau);
  if (n) Object.assign(n, champs);
}

function creer(id, champs = {}) {
  if (noeud(id)) return;
  g.nodes.push({id, url: "", ...champs});
  note(`créé : « ${id} »${champs.url ? "" : " (sans adresse, à compléter)"}`);
}

function relier(source, target, type) {
  if (g.edges.some((e) => e.source === source && e.target === target)) return;
  g.edges.push({source, target, type});
  note(`arête ajoutée : ${source} → ${target} [${type}]`);
}

// --- 1. Identifiants avec espaces en trop
for (const n of [...g.nodes]) {
  const propre = n.id.replace(/\s+/g, " ").trim();
  if (propre !== n.id) renommer(n.id, propre);
}

// --- 2. Nœuds strictement identiques (même nom, mêmes champs)
{
  const vus = new Set();
  const avantN = g.nodes.length;
  g.nodes = g.nodes.filter((n) => {
    const k = JSON.stringify(n);
    if (vus.has(k)) { note(`doublon exact supprimé : « ${n.id} »`); return false; }
    vus.add(k);
    return true;
  });
  void avantN;
}

// --- 3. « Critique de l'Intelligence Artificielle » : deux nœuds distincts
{
  const nom = "Critique de l’Intelligence Artificielle";
  const colloque = `${nom} (colloque, Paris 8)`;
  const organoesis = `${nom} (Organoesis)`;
  const versions = g.nodes.filter((n) => n.id === nom);
  if (versions.length) {
    for (const n of versions) n.id = /univ-paris8/.test(n.url) ? colloque : organoesis;
    for (const e of g.edges) {
      if (e.source === nom) e.source = colloque;
      if (e.target === nom) e.target = colloque;
    }
    note(`« ${nom} » séparé en « ${colloque} » (toutes les arêtes) et « ${organoesis} »`);
    relier("Organoesis", organoesis, "Projet");
  }
}

// --- 4. Fusions et corrections décidées
renommer("Penser l'humain et la technique Simondon et Derrida après la métaphysique",
         "Penser l'humain et la technique : Simondon et Derrida après la métaphysique");
renommer("Schizophrénie numérique : la crise de l'esprit à l'ère des nouvelles technologies", "Schizophrénie numérique");
renommer("Condition de l'homme moderne (1958", "Condition de l'homme moderne", {year: 1958});
renommer("H. Arendt", "Hannah Arendt");

// --- 5. Arêtes vers des nœuds absents
renommer("Jaques Lacan", "Jacques Lacan");
renommer("Michal Krzykawski", "Michał Krzykawski");
renommer("∏node", "∏Node");
renommer("art", "Art");
renommer("musique", "Musique");
creer("Logique");
creer("Frédéric Kaplan");

// --- 6. Arêtes en double (après les fusions, qui peuvent en créer)
{
  const vus = new Set();
  g.edges = g.edges.filter((e) => {
    const k = `${e.source}\u0000${e.target}\u0000${e.type}`;
    if (vus.has(k)) { note(`arête en double supprimée : ${e.source} → ${e.target} [${e.type}]`); return false; }
    vus.add(k);
    return true;
  });
}

// --- 7. Années en nombre
for (const n of g.nodes) {
  if (typeof n.year === "string" && /^\d{4}$/.test(n.year.trim())) {
    note(`année en nombre : « ${n.id} » ${JSON.stringify(n.year)} → ${Number(n.year)}`);
    n.year = Number(n.year);
  }
}

// --- Contrôles
const ids = new Set(g.nodes.map((n) => n.id));
const pendantes = g.edges.filter((e) => !ids.has(e.source) || !ids.has(e.target));
const doublons = g.nodes.length - ids.size;
const quasi = new Map();
for (const id of ids) { const k = normaliserTexte(id); quasi.set(k, (quasi.get(k) || 0) + 1); }

console.log(journal.length ? journal.map((l) => "- " + l).join("\n") : "Rien à faire : le graphe est déjà nettoyé.");
console.log(`\nAvant : ${avant.noeuds} nœuds, ${avant.aretes} arêtes`);
console.log(`Après : ${g.nodes.length} nœuds, ${g.edges.length} arêtes`);
console.log(`Contrôles : ${pendantes.length} arête(s) pendante(s), ${doublons} identifiant(s) en double, ${[...quasi.values()].filter((k) => k > 1).length} quasi-doublon(s)`);
if (pendantes.length) pendantes.forEach((e) => console.log("  pendante :", e));

if (process.argv.includes("--appliquer")) {
  writeFileSync(fichier, JSON.stringify(g, null, 2) + "\n");
  console.log("\nFichier écrit :", fichier.pathname);
} else {
  console.log("\n(simulation : relancer avec --appliquer pour écrire le fichier)");
}
