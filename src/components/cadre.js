// Cadre des graphiques de l'accueil : bouton plein écran et lien vers le
// notebook ObservableHQ d'origine (les graphiques sont désormais dans Framework).
export function cadre(contenu, {titre, notebook, hauteur} = {}) {
  const zone = document.createElement("div");
  zone.className = "notebook-graphe";
  if (hauteur) zone.style.height = `${hauteur}px`;
  if (titre) zone.setAttribute("aria-label", titre);
  zone.append(contenu);

  const plein = document.createElement("button");
  plein.type = "button";
  plein.textContent = "Plein écran";
  plein.addEventListener("click", () => zone.requestFullscreen?.());

  const legende = document.createElement("figcaption");
  legende.append(plein);
  if (notebook) {
    const lien = document.createElement("a");
    lien.href = `https://observablehq.com/${notebook}`;
    lien.target = "_blank";
    lien.rel = "noopener";
    lien.textContent = "Notebook sur ObservableHQ ↗";
    legende.append(lien);
  }

  const figure = document.createElement("figure");
  figure.className = "notebook";
  figure.append(zone, legende);
  return figure;
}
