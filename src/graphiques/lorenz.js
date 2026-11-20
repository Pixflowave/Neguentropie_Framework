// Attracteur étrange d'Edward Lorenz tracé sur la carte Airocean.
// Port du notebook ObservableHQ @pixflowave/airocean-attracteur-de-lorenz
// (cellule dual), qui reprend les notebooks de Philippe Rivière
// @fil/triangular-tiling-of-icosahedron et @fil/airocean-projection.
// La carte découpée en 500 triangles est précalculée (npm run airocean) ;
// seul l'attracteur, très léger, est calculé ici.
//
// Module exporté (dynamicPaths) : pixflowave.fr l'importe aussi.
//   import {lorenz} from "https://framework.neguentropie.art/graphiques/lorenz.js";
//   element.append(await lorenz());
import {FileAttachment} from "observablehq:stdlib";

const SVG = "http://www.w3.org/2000/svg";
let compteur = 0; // identifiants de dégradé uniques si le graphique est affiché plusieurs fois

// Réglages par défaut du notebook (valeurs classiques de Lorenz pour sigma, rho, beta)
// style : "fediverse" (terres en dégradé des 5 couleurs des nœuds du logo) ou "doree" (ancienne version or)
export const REGLAGES = {sigma: 10, rho: 28, beta: 2.667, h: 0.007, npts: 6912, rotZ: 0.3184, couleur: "#fff8e7", style: "fediverse"};

// Couleurs des nœuds du logo du Fediverse (version Wikimedia), les mêmes que FEDI.noeud
// dans la vue 3D de l'enveloppe : jaune, vert, bleu, violet, rouge.
export const FEDI_NOEUDS = ["#ffca00", "#64ff00", "#00a3ff", "#9500ff", "#ff0000"];
// Tracés du logo du Fediverse (Fediverse_logo_proposal.svg, Wikimedia Commons, domaine public), viewBox 196,52
const FEDI_LOGO = [
  ["#a730b8", "M47.9242 72.7966a18.2278 18.2278 0 0 1-7.7959 7.7597l42.7984 42.9653 10.3182-5.2291zm56.4524 56.6704-10.3182 5.2291 21.686 21.7708a18.2278 18.2278 0 0 1 7.7975-7.7608z"],
  ["#5496be", "M129.6645 102.0765l1.7865 11.4272 27.4149-13.8942a18.2278 18.2278 0 0 1-4.9719-9.8124zm-14.0658 7.1282-57.2891 29.0339a18.2278 18.2278 0 0 1 4.9728 9.8133l54.1027-27.4194z"],
  ["#ce3d1a", "M69.5312 91.6539l8.1618 8.1933 29.269-57.1387a18.2278 18.2278 0 0 1-9.787-5.0219zm-7.1897 14.0363-14.0022 27.3353a18.2278 18.2278 0 0 1 9.786 5.0214l12.3775-24.1639z"],
  ["#d0188f", "M39.8906 80.6763a18.2278 18.2278 0 0 1-10.8655 1.7198l8.1762 52.2981a18.2278 18.2278 0 0 1 10.8645-1.7198z"],
  ["#5b36e9", "M63.3259 148.3109a18.2278 18.2278 0 0 1-1.7322 10.8629l52.2893 8.3907a18.2278 18.2278 0 0 1 1.7322-10.8629z"],
  ["#30b873", "M134.9148 146.9182a18.2278 18.2278 0 0 1 9.788 5.0224l24.1345-47.117a18.2278 18.2278 0 0 1-9.7875-5.0229z"],
  ["#ebe305", "M126.1329 33.1603a18.2278 18.2278 0 0 1-7.7975 7.7608l37.3765 37.5207a18.2278 18.2278 0 0 1 7.7969-7.7608z"],
  ["#f47601", "M44.7704 51.6279a18.2278 18.2278 0 0 1 4.9723 9.8123l47.2478-23.9453a18.2278 18.2278 0 0 1-4.9718-9.8113z"],
  ["#57c115", "M118.2491 40.9645a18.2278 18.2278 0 0 1-10.8511 1.8123l4.1853 26.8 11.42 1.8324zm-4.2333 44.1927 9.8955 63.3631a18.2278 18.2278 0 0 1 10.88-1.6278l-9.355-59.9035z"],
  ["#dbb210", "M49.7763 61.6412a18.2278 18.2278 0 0 1-1.694 10.8686l26.8206 4.3077 5.2715-10.2945zm45.9677 7.382-5.272 10.2955 63.3713 10.1777a18.2278 18.2278 0 0 1 1.7606-10.8593z"],
  ["#ffca00", "M93.4385 23.8419a1 1 0 1 0 33.0924 1.8025 1 1 0 1 0-33.0924-1.8025"],
  ["#64ff00", "M155.314 85.957a1 1 0 1 0 33.0923 1.8025 1 1 0 1 0-33.0923-1.8025"],
  ["#00a3ff", "M115.3466 163.9824a1 1 0 1 0 33.0923 1.8025 1 1 0 1 0-33.0923-1.8025"],
  ["#9500ff", "M28.7698 150.0898a1 1 0 1 0 33.0923 1.8025 1 1 0 1 0-33.0923-1.8025"],
  ["#ff0000", "M15.2298 63.4781a1 1 0 1 0 33.0923 1.8025 1 1 0 1 0-33.0923-1.8025"]
];

export async function lorenz(options = {}) {
  const {sigma, rho, beta, h, npts, rotZ, couleur, style} = {...REGLAGES, ...options};
  const fedi = style === "fediverse";
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

  // Style Fediverse : dégradé circulaire sur la largeur de la carte, comme le tour de
  // l'enveloppe dans la vue 3D. Chaque couleur est pure au centre de son cinquième,
  // et les deux bords se rejoignent sur le mélange rouge-jaune.
  const idDegrade = `lorenz-fedi-${++compteur}`;
  if (fedi) {
    const degrade = element("linearGradient", {id: idDegrade, gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: width, y2: 0}, element("defs", {}, svg));
    const n = FEDI_NOEUDS.length, bord = melange(FEDI_NOEUDS[n - 1], FEDI_NOEUDS[0]);
    [[0, bord], ...FEDI_NOEUDS.map((c, i) => [(i + 0.5) / n, c]), [1, bord]].forEach(([offset, c]) =>
      element("stop", {offset, "stop-color": c}, degrade));
  }
  // Petite mention de l'origine des couleurs, en bas à gauche (zone sans terres)
  if (fedi) {
    // Logo du Fediverse (tracés originaux), 18 unités de côté
    const t = 18, x0 = 8, y0 = height - 8 - t + 3, cx = x0 + t / 2, r = t / 2;
    const logo = element("g", {transform: `translate(${x0},${y0}) scale(${t / 196.52})`}, svg);
    for (const [fill, d] of FEDI_LOGO) element("path", {fill, d}, logo);
    const ref = element("text", {x: cx + r + 6, y: height - 8, "font-family": "Raleway, system-ui, sans-serif", "font-weight": 300, "font-size": 11, fill: "#fff8e7", "fill-opacity": 0.75}, svg);
    ref.textContent = "Couleurs : logo du Fediverse (Eukombos et Dr. Quadragon, domaine public)";
  }
  const terre = fedi
    ? {fill: `url(#${idDegrade})`, "fill-opacity": 0.55, stroke: "#fff8e7", "stroke-opacity": 0.6, "stroke-width": 0.6}
    : {fill: "rgba(255,197,54, 0.18)", stroke: "#ffe29b"};

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
      if (triangles[i].l) element("path", {d: triangles[i].l, ...terre}, groupe);
      await pause(20);
    }
    const g = element("g", {id: "attracteur"}, svg);
    element("path", {d: attracteur.chemin, fill: "none", stroke: couleur, "stroke-width": 1}, g);
    element("circle", {cx: attracteur.fin[0], cy: attracteur.fin[1], r: 5, fill: "#fff8e7"}, g);
  })();

  return svg;
}

// Moyenne de deux couleurs #rrggbb
function melange(a, b) {
  const v = (c, k) => parseInt(c.slice(1 + 2 * k, 3 + 2 * k), 16);
  return "#" + [0, 1, 2].map((k) => Math.round((v(a, k) + v(b, k)) / 2).toString(16).padStart(2, "0")).join("");
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
