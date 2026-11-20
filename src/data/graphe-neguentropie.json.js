// Graphe réticulé des bifurcations noétiques : données + disposition précalculée.
// Mêmes forces que le notebook @pixflowave/graph_neguentropie ; la simulation
// tourne ici, au build, et le navigateur affiche directement les positions finales.
import {readFileSync} from "node:fs";
import * as d3 from "d3";
import {appliquerForces} from "../graphiques/forces.js";

const data = JSON.parse(readFileSync("src/data/neguentropie_Graph.json", "utf8"));

const ids = Array.from(new Set([...data.nodes.map((n) => n.id), ...data.edges.flatMap((e) => [e.source, e.target])]));
const parId = new Map(data.nodes.map((n) => [n.id, n]));
const nodes = ids.map((id) => ({id, url: parId.get(id)?.url || null, enfants: 0, parents: 0}));
const noeud = new Map(nodes.map((n) => [n.id, n]));

const vus = new Set();
const links = data.edges
  .filter((e) => typeof e.source === "string" && typeof e.target === "string")
  .filter((e) => !vus.has(`${e.source}-->${e.target}`) && vus.add(`${e.source}-->${e.target}`))
  .map((e) => ({source: e.source, target: e.target, type: e.type}));

for (const {source, target} of links) {
  noeud.get(source).enfants++;
  noeud.get(target).parents++;
}
for (const n of nodes) {
  n.degre = n.enfants + n.parents;
}

// Forces partagées avec graphiques/graphe.js. Disposition de départ
// déterministe (spirale de d3), donc résultat reproductible d'un build à l'autre.
const simulation = appliquerForces(d3, d3.forceSimulation(nodes), nodes, links.map((l) => ({...l}))).stop();
for (let i = 0, n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())); i < n; ++i) simulation.tick();

process.stdout.write(JSON.stringify({
  nodes: nodes.map(({id, url, enfants, parents, degre, x, y}) => ({id, url, enfants, parents, degre, x: Math.round(x), y: Math.round(y)})),
  links
}));
