// Réglages des forces du graphe réticulé, partagés par le chargeur
// (data/graphe-neguentropie.json.js, disposition calculée au build) et par
// graphiques/graphe.js (simulation relancée quand on glisse un nœud).
// Sans import : on reçoit d3, pour servir côté Node comme côté navigateur.
//
// Principe (2026-11-20) : chaque nœud peu relié reste près de son centre,
// les nœuds très reliés s'écartent les uns des autres. Avant : tous les
// liens mesuraient 350 et la répulsion croissait avec enfants × parents²,
// le graphe s'étalait sur plus de 4 000 unités et les feuilles partaient au loin.

/** Rayon d'un nœud selon son nombre de relations. */
export function rayonNoeud(d3, nodes) {
  return d3.scaleSqrt().domain([0, d3.max(nodes, (d) => d.degre) || 1]).range([3, 14]);
}

/** Ajoute les forces à une simulation dont les nœuds ont `degre`. */
export function appliquerForces(d3, simulation, nodes, links) {
  const rayon = rayonNoeud(d3, nodes);
  const degre = (n) => (typeof n === "object" ? n.degre : 1) || 1;
  const plusPetit = (l) => Math.min(degre(l.source), degre(l.target));
  return simulation
    // Lien court vers une feuille, plus long entre deux nœuds très reliés
    .force("link", d3.forceLink(links).id((d) => d.id)
      .distance((l) => (plusPetit(l) === 1 ? 45 : 70 + 22 * Math.sqrt(plusPetit(l))))
      .strength((l) => 1 / plusPetit(l)))
    // Répulsion selon le nombre de relations, limitée en portée
    .force("charge", d3.forceManyBody().strength((d) => -(40 + 18 * d.degre)).distanceMax(900).theta(0.8))
    .force("center", d3.forceCenter(0, 0))
    // Légère attraction vers le centre : les îlots ne partent pas au loin
    .force("x", d3.forceX(0).strength(0.04))
    .force("y", d3.forceY(0).strength(0.04))
    .force("collide", d3.forceCollide().radius((d) => rayon(d.degre) + 5).iterations(2));
}
