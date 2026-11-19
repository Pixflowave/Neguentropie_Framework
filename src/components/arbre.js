import * as Plot from "npm:@observablehq/plot";
import {svg} from "npm:htl";

// Arbre des participants d'un projet : "Projet/Personne", une ligne par personne.
// Chaque arbre a son propre identifiant de dégradé (plusieurs arbres par page).
let compteur = 0;

export function arbre(chemins, {height = 250, marginTop = 25, marginBottom = 25} = {}) {
  const id = `degrade-arbre-${++compteur}`;
  return Plot.plot({
    axis: null,
    width: 1000,
    height,
    marginTop,
    marginBottom,
    marginRight: 10,
    marginLeft: 150,
    marks: [
      () => svg`<defs>
        <linearGradient id=${id} gradientTransform="rotate(90)">
          <stop offset="15%" stop-color="purple" />
          <stop offset="75%" stop-color="red" />
          <stop offset="100%" stop-color="gold" />
        </linearGradient>
      </defs>`,
      Plot.tree(chemins, {
        dx: -5,
        dy: -10,
        fontSize: 12,
        textLayout: "normal",
        treeAnchor: "right",
        strokeWidth: 2,
        strokeOpacity: 0.5,
        stroke: `url(#${id})`,
        curve: courbeBosse
      })
    ]
  });
}

// Même courbe que d3.curveBumpX, avec un décalage vertical de 0,001 px.
// Sans lui, le lien horizontal (arbre à nombre impair de personnes) a une boîte
// de hauteur nulle et le dégradé vertical, calculé sur cette boîte, n'est pas dessiné.
function courbeBosse(context) {
  let x0, y0, point;
  return {
    areaStart() {},
    areaEnd() {},
    lineStart() { point = 0; },
    lineEnd() {},
    point(x, y) {
      x = +x, y = +y;
      if (point === 0) { point = 1; context.moveTo(x, y); }
      else context.bezierCurveTo(x0 = (x0 + x) / 2, y0 + 1e-3, x0, y, x, y);
      x0 = x, y0 = y;
    }
  };
}
