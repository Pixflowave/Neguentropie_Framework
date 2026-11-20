// Graphe réticulé des bifurcations noétiques du pharmakon Néguentropie.
// Port du notebook ObservableHQ @pixflowave/graph_neguentropie (cellule chartR).
// Les positions sont calculées au build (data/graphe-neguentropie.json.js) :
// le graphe s'affiche tout de suite ; glisser un nœud relance la simulation,
// avec les mêmes forces (graphiques/forces.js).
//
// Apparition des noms selon le zoom (2026-11-20, apprécié par Erwan) :
// étiquettes à taille constante à l'écran ; de loin, seuls les nœuds très
// reliés sont nommés, les autres apparaissent en zoomant (`seuil`) ; le type
// des liens apparaît de près ; titres longs abrégés ; aucune étiquette n'en
// chevauche une autre (`placerEtiquettes`).
// Essayés puis retirés à la demande d'Erwan : survol qui allume les voisins
// (clignotement désagréable), vue d'ensemble à l'ouverture et son bouton (on
// perd la « constellation »), arcs aplatis.
//
// Module exporté (dynamicPaths) : pixflowave.fr l'importe aussi.
//   import {graphe} from "https://framework.neguentropie.art/graphiques/graphe.js";
//   element.append(await graphe());
import * as d3 from "npm:d3";
import {FileAttachment} from "observablehq:stdlib";
import {appliquerForces, rayonNoeud} from "./forces.js";

const PALETTE = ["#ffc536", "#e7eeff", "#ffe29b", "#e7fff8", "#ffd671", "#ffe7ee", "#fff1ce", "#f8e7ff", "#ffe9b4", "#fff8e7"];
const FOND = "#565656";
const TAILLE_ETIQUETTE = 11; // px à l'écran
const TAILLE_TYPE = 9;       // px à l'écran, type des liens
const LONGUEUR_MAX = 34;     // caractères avant « … »
const VUE = 1200;            // viewBox carré, centré sur 0

export async function graphe({hauteur = "100%"} = {}) {
  const data = await FileAttachment("../data/graphe-neguentropie.json").json();
  const nodes = data.nodes.map((n) => ({...n}));
  const links = data.links.map((l) => ({...l, id: `${l.source}-->${l.target}`}));

  const types = Array.from(new Set(links.map((e) => e.type)));
  const color = d3.scaleOrdinal(types, PALETTE);
  const rayon = rayonNoeud(d3, nodes);

  // Simulation arrêtée : elle ne repart que si l'on déplace un nœud
  const simulation = appliquerForces(d3, d3.forceSimulation(nodes), nodes, links).alpha(0).stop();

  const container = d3.create("div")
    .attr("class", "graphe-neguentropie")
    .style("position", "relative")
    .style("background", FOND)
    .style("color", "#fff8e7")
    .style("width", "100%")
    .style("height", typeof hauteur === "number" ? `${hauteur}px` : hauteur)
    .style("overflow", "hidden");

  // --- Barre de recherche
  const searchContainer = container.append("div")
    .style("position", "absolute").style("top", "15px").style("left", "15px").style("z-index", "1000")
    .style("display", "flex").style("align-items", "center").style("gap", "10px");
  const zoneChamp = searchContainer.append("div").style("position", "relative");

  const champ = (sel) => sel.style("background", "rgba(86, 86, 86, 0.9)").style("color", "#fff8e7").style("font-size", "14px");
  const searchInput = champ(zoneChamp.append("input"))
    .attr("type", "search").attr("placeholder", "Rechercher un point...").attr("aria-label", "Rechercher un point du graphe")
    .attr("autocomplete", "off").attr("role", "combobox").attr("aria-expanded", "false").attr("aria-controls", "graphe-suggestions")
    .style("padding", "10px").style("width", "240px").style("border", "none").style("border-bottom", "2px solid #ffc536");
  const suggestions = zoneChamp.append("ul")
    .attr("id", "graphe-suggestions").attr("role", "listbox")
    .style("position", "absolute").style("top", "100%").style("left", "0").style("margin", "4px 0 0").style("padding", "0")
    .style("list-style", "none").style("width", "320px").style("max-height", "260px").style("overflow-y", "auto")
    .style("background", "rgba(77, 77, 77, 0.97)").style("border", "1px solid #7a7a7a").style("border-radius", "4px")
    .style("font-size", "13px").style("display", "none");
  const resultCounter = champ(searchContainer.append("div"))
    .style("padding", "10px").style("font-weight", "bold").style("display", "none").text("0/0");
  const navButtons = searchContainer.append("div").style("display", "none").style("gap", "5px").style("flex-direction", "column");
  const bouton = (texte, titre) => champ(navButtons.append("button"))
    .attr("type", "button").attr("aria-label", titre).attr("title", titre).text(texte)
    .style("padding", "5px 10px").style("cursor", "pointer").style("border", "1px solid #ffc536")
    .style("border-radius", "3px").style("font-size", "12px");
  const btnUp = bouton("▲", "Résultat précédent");
  const btnDown = bouton("▼", "Résultat suivant");

  // --- Dessin (traits, arcs et flèches du notebook)
  const svg = container.append("svg")
    .attr("viewBox", [-VUE / 2, -VUE / 2, VUE, VUE])
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("width", "100%").attr("height", "100%")
    // style explicite : la feuille de style de Framework donne « height: auto »
    // aux SVG, le graphe devenait carré et débordait du cadre (zoom décentré)
    .style("width", "100%").style("height", "100%")
    .style("display", "block")
    .style("font-family", "var(--sans-serif, sans-serif)");
  const g = svg.append("g");

  svg.append("defs").selectAll("marker").data(types).join("marker")
    .attr("id", (d, i) => `fleche-graphe-${i}`)
    .attr("viewBox", "0 -5 10 10").attr("refX", 15).attr("refY", -0.5)
    .attr("markerWidth", 3).attr("markerHeight", 3).attr("orient", "auto")
    .append("path").attr("fill", color).attr("d", "M0,-5L10,0L0,5");

  const link = g.append("g").attr("fill", "none").attr("stroke-opacity", 0.6).attr("stroke-width", 1)
    .selectAll("g.link").data(links).join("g").attr("class", "link");
  link.append("path")
    .attr("stroke", (d) => color(d.type))
    .attr("marker-end", (d) => `url(#fleche-graphe-${types.indexOf(d.type)})`);
  const linkLabel = link.append("text")
    .attr("fill", "#ffe29b").attr("text-anchor", "middle").attr("dy", "0.35em")
    .attr("paint-order", "stroke").attr("stroke", FOND).attr("stroke-linejoin", "round")
    .attr("display", "none")
    .text((d) => d.type);

  const abrege = (t) => (t.length > LONGUEUR_MAX ? t.slice(0, LONGUEUR_MAX - 1).trimEnd() + "…" : t);
  const node = g.append("g").attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
    .selectAll("g.node").data(nodes).join("g").attr("class", "node")
    .call(d3.drag()
      .on("start", (event) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on("drag", (event) => {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      })
      .on("end", (event) => {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }));
  node.append("title").text((d) => d.id);
  const cercle = node.append("circle")
    .attr("fill", (d) => (d.enfants > 0 ? "#fff8e7" : "#ffc536"))
    .attr("r", (d) => rayon(d.degre));
  const etiquette = node.append("a")
    .attr("href", (d) => d.url || null).attr("target", "_blank").attr("rel", "noopener")
    .style("text-decoration", "none")
    .append("text")
    .attr("dy", "0.32em")
    .attr("fill", (d) => (d.enfants > 0 ? "#fff8e7" : "#ffe29b"))
    .attr("paint-order", "stroke").attr("stroke", FOND).attr("stroke-linejoin", "round")
    .text((d) => abrege(d.id));

  function dessiner() {
    link.selectAll("path").attr("d", (d) => {
      const dr = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y);
      return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
    });
    // Le type se place au sommet de l'arc. Avec « sweep » à 1 (sens horaire à
    // l'écran), l'arc se bombe à gauche du trajet source → cible : (dy, −dx).
    linkLabel.each(function (d) {
      const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
      const dr = Math.hypot(dx, dy) || 1;
      const fleche = dr * (1 - Math.sqrt(3) / 2); // flèche d'un arc de rayon dr sur une corde dr
      this.setAttribute("x", (d.source.x + d.target.x) / 2 + (dy / dr) * fleche);
      this.setAttribute("y", (d.source.y + d.target.y) / 2 + (-dx / dr) * fleche);
    });
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  }
  simulation.on("tick", dessiner);

  // --- Échelle apparente : pixels à l'écran par unité du graphe
  let pxParUnite = 0.5; // recalculé dès que le cadre a une taille
  let echelle = 0.5;    // = transform.k × pxParUnite, mis à jour au zoom

  // Nombre de relations à partir duquel un nœud est nommé, selon l'échelle apparente
  const seuil = (a) => (a >= 1.1 ? 0 : a >= 0.8 ? 2 : a >= 0.55 ? 4 : a >= 0.38 ? 8 : 14);
  const ECHELLE_TYPES = 1.2; // à partir de là, le type des liens apparaît

  let resultats = new Set(); // résultats de la recherche (toujours nommés)
  let cible = null;          // résultat courant

  // Étiquettes sans chevauchement : placées par ordre d'importance (résultat
  // courant, résultats, puis les plus reliés) ; une étiquette qui en
  // chevaucherait une déjà placée est masquée. Boîtes estimées en unités du
  // graphe (largeur ≈ 0,58 × taille × nombre de caractères).
  function placerEtiquettes(a) {
    const s = seuil(a);
    const f = TAILLE_ETIQUETTE / a;
    const boites = [];
    const libre = (b) => !boites.some((c) => b.x0 < c.x1 && c.x0 < b.x1 && b.y0 < c.y1 && c.y0 < b.y1);
    const priorite = (d) => (d === cible ? 0 : resultats.has(d) ? 1 : 2);
    const noeuds = new Set();
    const candidats = nodes.filter((d) => d.degre >= s || resultats.has(d))
      .sort((p, q) => priorite(p) - priorite(q) || q.degre - p.degre);
    for (const d of candidats) {
      const x0 = d.x + rayon(d.degre) + 3 / a;
      const b = {x0, x1: x0 + 0.58 * f * abrege(d.id).length, y0: d.y - 0.6 * f, y1: d.y + 0.6 * f};
      if (d === cible || libre(b)) { boites.push(b); noeuds.add(d); }
    }
    const liens = new Set();
    if (a >= ECHELLE_TYPES) {
      // Seulement les liens dont les deux nœuds sont dans le cadre : de près,
      // les grands arcs qui traversent l'écran ne sont pas nommés.
      const t = d3.zoomTransform(svg.node());
      const {width: w, height: h} = svg.node().getBoundingClientRect();
      const [gx0, gy0] = t.invert([-w / pxParUnite / 2, -h / pxParUnite / 2]);
      const [gx1, gy1] = t.invert([w / pxParUnite / 2, h / pxParUnite / 2]);
      const dedans = (n) => n.x >= gx0 && n.x <= gx1 && n.y >= gy0 && n.y <= gy1;
      const ft = TAILLE_TYPE / a;
      linkLabel.each(function (l) {
        if (!dedans(l.source) || !dedans(l.target)) return;
        const x = +this.getAttribute("x"), y = +this.getAttribute("y");
        const w = 0.58 * ft * l.type.length;
        const b = {x0: x - w / 2, x1: x + w / 2, y0: y - 0.6 * ft, y1: y + 0.6 * ft};
        if (libre(b)) { boites.push(b); liens.add(l); }
      });
    }
    return {noeuds, liens};
  }

  function majAffichage() {
    const a = echelle;
    const {noeuds, liens} = placerEtiquettes(a);
    etiquette
      .attr("font-size", TAILLE_ETIQUETTE / a)
      .attr("stroke-width", 3 / a)
      .attr("x", (d) => rayon(d.degre) + 3 / a)
      .attr("font-weight", (d) => (d === cible ? "bold" : null))
      .attr("display", (d) => (noeuds.has(d) ? null : "none"));
    linkLabel
      .attr("font-size", TAILLE_TYPE / a).attr("stroke-width", 2.5 / a)
      .attr("display", (l) => (liens.has(l) ? null : "none"));
    cercle
      .attr("stroke", (d) => (d === cible ? "#ffffff" : resultats.has(d) ? "#e7eeff" : null))
      .attr("stroke-width", (d) => (d === cible ? 4 : resultats.has(d) ? 2 : null));
  }

  let image = 0;
  const zoom = d3.zoom().scaleExtent([0.1, 8]).on("zoom", (event) => {
    g.attr("transform", event.transform);
    echelle = event.transform.k * pxParUnite;
    cancelAnimationFrame(image);
    image = requestAnimationFrame(majAffichage);
  });
  svg.call(zoom);

  // Taille du cadre → échelle apparente (la vue de départ reste celle du notebook)
  new ResizeObserver(() => {
    const {width: w, height: h} = svg.node().getBoundingClientRect();
    if (!w || !h) return;
    pxParUnite = Math.min(w, h) / VUE;
    echelle = d3.zoomTransform(svg.node()).k * pxParUnite;
    majAffichage();
  }).observe(svg.node());

  // --- Recherche : insensible à la casse, aux accents et à l'ordre des mots.
  // Suggestions pendant la frappe ; Entrée ou clic pour zoomer, ↑ ↓ pour
  // passer d'un résultat à l'autre, Échap pour effacer.
  const normaliser = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l").replace(/[øØ]/g, "o").replace(/æ/gi, "ae").replace(/œ/gi, "oe").replace(/ß/g, "ss")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  for (const d of nodes) d.cle = normaliser(d.id);

  function chercher(texte) {
    const q = normaliser(texte);
    if (!q) return [];
    const mots = q.split(" ");
    const tous = nodes.filter((d) => mots.every((m) => d.cle.includes(m)));
    if (tous.length || mots.length === 1) {
      return tous
        .map((d) => {
          const debutMots = mots.every((m) => d.cle.startsWith(m) || d.cle.includes(" " + m));
          return {d, rang: d.cle === q ? 0 : d.cle.startsWith(q) ? 1 : debutMots ? 2 : 3};
        })
        .sort((a, b) => a.rang - b.rang || b.d.degre - a.d.degre || a.d.id.localeCompare(b.d.id, "fr"))
        .map((x) => x.d);
    }
    // Aucun nœud ne contient tous les mots (« stiegler technique ») : ceux
    // qui en contiennent le plus, puis les plus reliés.
    return nodes
      .map((d) => ({d, n: mots.filter((m) => m.length > 1 && d.cle.includes(m)).length}))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || b.d.degre - a.d.degre || a.d.id.localeCompare(b.d.id, "fr"))
      .map((x) => x.d);
  }

  let currentMatches = [];
  let currentIndex = -1; // -1 : rien de sélectionné (suggestions seulement)

  function updateNavigation() {
    const visible = currentMatches.length > 0 && currentIndex >= 0;
    resultCounter.style("display", currentMatches.length ? "block" : "none")
      .text(currentIndex >= 0 ? `${currentIndex + 1}/${currentMatches.length}` : `${currentMatches.length}`);
    navButtons.style("display", visible && currentMatches.length > 1 ? "flex" : "none");
  }
  function afficherSuggestions() {
    const liste = currentMatches.slice(0, 50);
    searchInput.attr("aria-expanded", liste.length ? "true" : "false");
    suggestions.style("display", liste.length ? "block" : "none");
    suggestions.selectAll("li").data(liste, (d) => d.id).join("li")
      .attr("role", "option")
      .attr("aria-selected", (d, i) => (i === currentIndex ? "true" : "false"))
      .style("padding", "6px 10px").style("cursor", "pointer").style("color", "#fff8e7")
      .style("background", (d, i) => (i === currentIndex ? "rgba(255, 197, 54, 0.25)" : "none"))
      .text((d) => d.id)
      .on("mousedown", (event) => event.preventDefault()) // garder le focus dans le champ
      .on("click", (event, d) => { currentIndex = currentMatches.indexOf(d); aller(); });
    const actif = suggestions.selectAll("li").filter((d, i) => i === currentIndex).node();
    if (actif) actif.scrollIntoView({block: "nearest"});
  }
  function surligner() {
    resultats = new Set(currentMatches);
    cible = currentMatches[currentIndex] || null;
    majAffichage();
  }
  function aller() {
    updateNavigation();
    afficherSuggestions();
    surligner();
    if (!cible) return;
    // Centrer le nœud (origine du viewBox = centre du cadre), assez près
    // pour que les noms de son voisinage apparaissent
    const k = Math.max(d3.zoomTransform(svg.node()).k, 1.4 / pxParUnite);
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.scale(k).translate(-cible.x, -cible.y));
  }
  function effacer() {
    currentMatches = [];
    currentIndex = -1;
    updateNavigation();
    afficherSuggestions();
    surligner();
  }
  const revenir = () => svg.transition().duration(1000).call(zoom.transform, d3.zoomIdentity);
  const avancer = (pas) => () => {
    if (!currentMatches.length) return;
    currentIndex = currentIndex < 0 ? (pas > 0 ? 0 : currentMatches.length - 1)
      : (currentIndex + pas + currentMatches.length) % currentMatches.length;
    aller();
  };
  btnUp.on("click", avancer(-1));
  btnDown.on("click", avancer(1));

  let attente;
  searchInput.on("input", function () {
    clearTimeout(attente);
    const valeur = this.value;
    if (!valeur.trim()) {
      effacer();
      revenir();
      return;
    }
    attente = setTimeout(() => {
      currentMatches = chercher(valeur);
      currentIndex = -1;
      updateNavigation();
      afficherSuggestions();
      surligner();
    }, 120);
  });
  searchInput.on("keydown", function (event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      avancer(event.key === "ArrowDown" ? 1 : -1)();
    } else if (event.key === "Enter") {
      event.preventDefault();
      clearTimeout(attente);
      currentMatches = chercher(this.value);
      if (currentIndex < 0 || currentIndex >= currentMatches.length) currentIndex = 0;
      aller();
      suggestions.style("display", "none");
    } else if (event.key === "Escape") {
      this.value = "";
      effacer();
      revenir();
    }
  });
  searchInput.on("blur", () => suggestions.style("display", "none"));
  searchInput.on("focus", () => { if (currentMatches.length) afficherSuggestions(); });

  dessiner();
  majAffichage();
  return Object.assign(container.node(), {scales: {color}});
}
