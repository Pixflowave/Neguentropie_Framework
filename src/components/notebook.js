// Runtime Observable complet (même version que pixflowave.fr). Le runtime interne
// de Framework n'exporte ni Library ni Inspector : on charge celui-ci à la demande,
// pour qu'une panne du CDN ne touche que les graphiques, pas le reste de la page.
const RUNTIME = "https://cdn.jsdelivr.net/npm/@observablehq/runtime@5.9.9/+esm";

// Cellule d'un notebook ObservableHQ dessinée directement dans la page, sur le
// fond du site, comme sur pixflowave.fr : pas d'iframe, donc pas de fond blanc
// ni de filtre d'inversion. Les couleurs sont réglées dans les notebooks.
// Le notebook n'est chargé que quand le graphique approche de l'écran.
export function notebook(nom, cellule, {titre, hauteur = 400} = {}) {
  const graphe = document.createElement("div");
  graphe.className = "notebook-graphe";
  graphe.setAttribute("role", "img");
  if (titre) graphe.setAttribute("aria-label", titre);
  graphe.style.minHeight = `${hauteur}px`;

  const plein = document.createElement("button");
  plein.type = "button";
  plein.textContent = "Plein écran";
  plein.addEventListener("click", () => graphe.requestFullscreen?.());

  const lien = document.createElement("a");
  lien.href = `https://observablehq.com/embed/${nom}?cells=${cellule}`;
  lien.target = "_blank";
  lien.rel = "noopener";
  lien.textContent = "Ouvrir le graphique seul ↗";

  const legende = document.createElement("figcaption");
  legende.append(plein, lien);
  const figure = document.createElement("figure");
  figure.className = "notebook";
  figure.append(graphe, legende);

  const io = new IntersectionObserver(async (entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    try {
      const [{Runtime, Inspector, Library}, {default: define}] = await Promise.all([
        import(RUNTIME),
        import(`https://api.observablehq.com/${nom}.js?v=4`)
      ]);
      // « width » = largeur de l'emplacement, aussi pour les notebooks importés.
      const library = new Library();
      library.width = () =>
        library.Generators.observe((notify) => {
          const ro = new ResizeObserver(([entry]) => notify(Math.round(entry.contentRect.width)));
          ro.observe(graphe);
          notify(graphe.clientWidth);
          return () => ro.disconnect();
        });
      new Runtime(library).module(define, (name) => (name === cellule ? new Inspector(graphe) : undefined));
    } catch {
      graphe.textContent = "Graphique indisponible pour le moment.";
    }
  }, {rootMargin: "200px"});
  io.observe(graphe);

  return figure;
}
