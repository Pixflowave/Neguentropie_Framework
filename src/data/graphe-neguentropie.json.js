// Graphe réticulé des bifurcations noétiques : données + disposition précalculée.
// Mêmes forces que le notebook @pixflowave/graph_neguentropie ; la simulation
// tourne ici, au build, et le navigateur affiche directement les positions finales.
import {readFileSync} from "node:fs";
import {forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, max, scaleSqrt} from "d3";

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
  n.charge = -Math.max(n.enfants * n.parents ** 2, 400);
}

const rayon = scaleSqrt().domain([0, max(nodes, (d) => d.degre)]).range([4, 12]);
const simulation = forceSimulation(nodes)
  .force("link", forceLink(links.map((l) => ({...l}))).id((d) => d.id).distance(350).strength(1.5))
  .force("charge", forceManyBody().strength((d) => d.charge).theta(0.8))
  .force("center", forceCenter(0, 0))
  .force("collide", forceCollide().radius((d) => rayon(d.degre)).iterations(2))
  .stop();
for (let i = 0, n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())); i < n; ++i) simulation.tick();

process.stdout.write(JSON.stringify({
  nodes: nodes.map(({id, url, enfants, parents, degre, charge, x, y}) => ({id, url, enfants, parents, degre, charge, x: Math.round(x), y: Math.round(y)})),
  links
}));
