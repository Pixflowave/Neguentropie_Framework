// Réglages des forces du graphe réticulé, partagés par le chargeur
// (data/graphe-neguentropie.json.js, disposition calculée au build) et par
// graphiques/graphe.js (simulation relancée quand on glisse un nœud).
// Sans import : on reçoit d3, pour servir côté Node comme côté navigateur.
//
// Forces du notebook @pixflowave/graph_neguentropie (choix d'Erwan,
// 2026-11-20) : liens longs et grands arcs, la « constellation ». Un essai de
// forces plus compactes (liens de 45 à 70 + 22·√degré) rendait le graphe
// trois fois plus serré mais les arcs courts manquaient d'élégance.

/** Rayon d'un nœud selon son nombre de relations. */
export function rayonNoeud(d3, nodes) {
  return d3.scaleSqrt().domain([0, d3.max(nodes, (d) => d.degre) || 1]).range([4, 12]);
}

/** Ajoute les forces à une simulation dont les nœuds ont `enfants`, `parents`, `degre`. */
export function appliquerForces(d3, simulation, nodes, links) {
  const rayon = rayonNoeud(d3, nodes);
  return simulation
    .force("link", d3.forceLink(links).id((d) => d.id).distance(350).strength(1.5))
    .force("charge", d3.forceManyBody().strength((d) => -Math.max(d.enfants * d.parents ** 2, 400)).theta(0.8))
    .force("center", d3.forceCenter(0, 0))
    .force("collide", d3.forceCollide().radius((d) => rayon(d.degre)).iterations(2));
}
