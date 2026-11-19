// Attracteur étrange d'Edward Lorenz tracé sur la carte Airocean.
// Port du notebook ObservableHQ @pixflowave/airocean-attracteur-de-lorenz
// (cellule dual), qui reprend les notebooks de Philippe Rivière
// @fil/triangular-tiling-of-icosahedron et @fil/airocean-projection.
// La carte découpée en 500 triangles est précalculée (npm run airocean) ;
// seul l'attracteur, très léger, est calculé ici.
//
// Module exporté (dynamicPaths) : pixflowave.fr l'importe aussi.
//   import {lorenz} from "https://pixflowave.github.io/Neguentropie_Framework/graphiques/lorenz.js";
//   element.append(await lorenz());
import {FileAttachment} from "observablehq:stdlib";

const SVG = "http://www.w3.org/2000/svg";

// Réglages par défaut du notebook (valeurs classiques de Lorenz pour sigma, rho, beta)
export const REGLAGES = {sigma: 10, rho: 28, beta: 2.667, h: 0.007, npts: 6912, rotZ: 0.3184, couleur: "#fff8e7"};

export async function lorenz(options = {}) {
  const {sigma, rho, beta, h, npts, rotZ, couleur} = {...REGLAGES, ...options};
  const {largeur: width, hauteur: height, triangles} = await FileAttachment("../data/airocean-triangles.json").json();

  const element = (nom, attributs = {}, parent) => {
    const e = document.createElementNS(SVG, nom);
    for (const [k, v] of Object.entries(attributs)) e.setAttribute(k, v);
    parent?.append(e);
    return e;
  };

  const svg = element("svg", {viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "xMidYMid meet", role: "img"});
  svg.style.cssText = "display:block;width:100%;height:auto;background:#565656";
  element("title", {}, svg).textContent = "Attracteur étrange de Lorenz tracé sur la carte Airocean";

  // Carte : chaque triangle apparaît à son tour, comme dans le notebook
  const carte = element("g", {id: "carte"}, svg);
  const groupes = triangles.map(({t}) => {
    const groupe = element("g", {}, carte);
    element("path", {d: t, stroke: "#ffe29b", fill: "none"}, groupe);
    return groupe;
  });

  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const attracteur = trajectoire({sigma, rho, beta, h, npts, rotZ, width, height});

  (async () => {
    // Attendre que le SVG soit dans la page avant de lancer l'apparition
    while (!svg.isConnected) await pause(50);
    for (const [i, groupe] of groupes.entries()) {
      if (!svg.isConnected) return; // graphique retiré de la page
      const fond = groupe.firstChild;
      fond.setAttribute("fill", "rgba(255,248,231, 0.06)");
      fond.removeAttribute("stroke");
      if (triangles[i].l) element("path", {d: triangles[i].l, fill: "rgba(255,197,54, 0.18)", stroke: "#ffe29b"}, groupe);
      await pause(20);
    }
    const g = element("g", {id: "attracteur"}, svg);
    element("path", {d: attracteur.chemin, fill: "none", stroke: couleur, "stroke-width": 1}, g);
    element("circle", {cx: attracteur.fin[0], cy: attracteur.fin[1], r: 5, fill: "#fff8e7"}, g);
  })();

  return svg;
}

// Intégration de Runge-Kutta d'ordre 4, puis projection plane tournée de rotZ
// autour de l'axe vertical, mise à l'échelle comme dans le notebook.
function trajectoire({sigma, rho, beta, h, npts, rotZ, width, height}) {
  const f = (x, y, z) => [sigma * (y - x), -x * z + rho * x - y, x * y - beta * z];
  const pts = [[0, 0.1, 3]];
  for (let i = 1; i < npts; i++) {
    const [x, y, z] = pts[i - 1];
    const k0 = f(x, y, z).map((d) => h * d);
    const k1 = f(x + k0[0] / 2, y + k0[1] / 2, z + k0[2] / 2).map((d) => h * d);
    const k2 = f(x + k1[0] / 2, y + k1[1] / 2, z + k1[2] / 2).map((d) => h * d);
    const k3 = f(x + k2[0], y + k2[1], z + k2[2]).map((d) => h * d);
    pts.push([0, 1, 2].map((j) => pts[i - 1][j] + (k0[j] + 2 * k1[j] + 2 * k2[j] + k3[j]) / 6));
  }

  // Plage la plus large des trois coordonnées (le premier point est exclu, comme dans le notebook)
  let vmin = Infinity, vmax = -Infinity, plage = -Infinity;
  for (let j = 0; j < 3; j++) {
    let a = Infinity, b = -Infinity;
    for (let i = 1; i < npts; i++) (a = Math.min(a, pts[i][j])), (b = Math.max(b, pts[i][j]));
    if (b - a > plage) (vmin = a), (vmax = b), (plage = b - a);
  }

  const cos = Math.cos(rotZ), sin = Math.sin(rotZ);
  const ecran = ([x, y, z]) => [
    ((cos * x + sin * y - vmin) / (vmax - vmin)) * width,
    ((-z - 2 * vmin) / (vmax - vmin)) * height
  ];
  const points = pts.map(ecran);
  const chemin = "M" + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L");
  return {chemin, fin: points[points.length - 1]};
}
