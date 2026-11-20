// Graphe réticulé des bifurcations noétiques du pharmakon Néguentropie.
// Port du notebook ObservableHQ @pixflowave/graph_neguentropie (cellule chartR).
// Les positions sont calculées au build (data/graphe-neguentropie.json.js) :
// le graphe s'affiche tout de suite ; glisser un nœud relance la simulation.
//
// Module exporté (dynamicPaths) : pixflowave.fr l'importe aussi.
//   import {graphe} from "https://framework.neguentropie.art/graphiques/graphe.js";
//   element.append(await graphe());
import * as d3 from "npm:d3";
import {FileAttachment} from "observablehq:stdlib";

const PALETTE = ["#ffc536", "#e7eeff", "#ffe29b", "#e7fff8", "#ffd671", "#ffe7ee", "#fff1ce", "#f8e7ff", "#ffe9b4", "#fff8e7"];

export async function graphe({hauteur = "100%"} = {}) {
  const data = await FileAttachment("../data/graphe-neguentropie.json").json();
  const nodes = data.nodes.map((n) => ({...n}));
  const links = data.links.map((l) => ({...l, id: `${l.source}-->${l.target}`}));

  const types = Array.from(new Set(links.map((e) => e.type)));
  const color = d3.scaleOrdinal(types, PALETTE);
  const radiusScale = d3.scaleSqrt().domain([0, d3.max(nodes, (d) => d.degre)]).range([4, 12]);

  // Simulation arrêtée : elle ne repart que si l'on déplace un nœud
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id).distance(350).strength(1.5))
    .force("charge", d3.forceManyBody().strength((d) => d.charge).theta(0.8))
    .force("center", d3.forceCenter(0, 0))
    .force("collide", d3.forceCollide().radius((d) => radiusScale(d.degre)).iterations(2))
    .alpha(0)
    .stop();

  const width = 1200, height = 1200;
  const container = d3.create("div")
    .attr("class", "graphe-neguentropie")
    .style("position", "relative")
    .style("background", "#565656")
    .style("color", "#fff8e7")
    .style("width", "100%")
    .style("height", typeof hauteur === "number" ? `${hauteur}px` : hauteur)
    .style("overflow", "hidden");

  // Recherche
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
    .attr("type", "button").attr("aria-label", titre).text(texte)
    .style("padding", "5px 10px").style("cursor", "pointer").style("border", "1px solid #ffc536")
    .style("border-radius", "3px").style("font-size", "12px");
  const btnUp = bouton("▲", "Résultat précédent");
  const btnDown = bouton("▼", "Résultat suivant");

  const svg = container.append("svg")
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("width", "100%").attr("height", "100%")
    // style explicite : la feuille de style de Framework donne « height: auto »
    // aux SVG, le graphe devenait carré et débordait du cadre (zoom décentré)
    .style("width", "100%").style("height", "100%")
    .style("display", "block")
    .style("font", "12px sans-serif");
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
  link.append("text")
    .attr("fill", "#ffe29b").style("font", "normal 6px Arial")
    .attr("dy", ".35em").attr("text-anchor", "middle")
    .text((d) => d.type);

  const node = g.append("g").attr("fill", "currentColor").attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
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
  node.append("circle")
    .attr("fill", (d) => (d.enfants > 0 ? "#fff8e7" : "#ffc536"))
    .attr("r", (d) => radiusScale(d.degre));
  node.append("a")
    .attr("href", (d) => d.url || null).attr("target", "_blank").attr("rel", "noopener")
    .append("text").attr("x", 8).attr("y", "0.31em").text((d) => d.id);

  function dessiner() {
    link.selectAll("path").attr("d", (d) => {
      const dr = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y);
      return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
    });
    link.selectAll("text").attr("transform", (d) => `translate(${(d.source.x + d.target.x) / 2},${(d.source.y + d.target.y) / 2})`);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  }
  simulation.on("tick", dessiner);
  dessiner();

  const zoom = d3.zoom().scaleExtent([0.1, 8]).on("zoom", (event) => g.attr("transform", event.transform));
  svg.call(zoom);

  // Recherche : insensible à la casse, aux accents et à l'ordre des mots.
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
    const tous = new Set(currentMatches);
    const cible = currentMatches[currentIndex];
    node.selectAll("circle").transition().duration(300)
      .attr("stroke", (d) => (d === cible ? "#ffffff" : tous.has(d) ? "#e7eeff" : "none"))
      .attr("stroke-width", (d) => (d === cible ? 4 : tous.has(d) ? 2 : 0));
  }
  function aller() {
    updateNavigation();
    afficherSuggestions();
    surligner();
    const cible = currentMatches[currentIndex];
    if (!cible) return;
    // Centrer le nœud : origine du viewBox = centre du cadre
    const k = Math.max(2.5, d3.zoomTransform(svg.node()).k);
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.scale(k).translate(-cible.x, -cible.y));
  }
  function effacer() {
    currentMatches = [];
    currentIndex = -1;
    updateNavigation();
    afficherSuggestions();
    surligner();
  }
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
      svg.transition().duration(1000).call(zoom.transform, d3.zoomIdentity);
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
      svg.transition().duration(1000).call(zoom.transform, d3.zoomIdentity);
    }
  });
  searchInput.on("blur", () => suggestions.style("display", "none"));
  searchInput.on("focus", () => { if (currentMatches.length) afficherSuggestions(); });

  return Object.assign(container.node(), {scales: {color}});
}
