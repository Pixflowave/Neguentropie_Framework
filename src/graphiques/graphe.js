// Graphe réticulé des bifurcations noétiques du pharmakon Néguentropie.
// Port du notebook ObservableHQ @pixflowave/graph_neguentropie (cellule chartR).
// Les positions sont calculées au build (data/graphe-neguentropie.json.js) :
// le graphe s'affiche tout de suite ; glisser un nœud relance la simulation.
//
// Module exporté (dynamicPaths) : pixflowave.fr l'importe aussi.
//   import {graphe} from "https://pixflowave.github.io/Neguentropie_Framework/graphiques/graphe.js";
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
    .style("height", typeof hauteur === "number" ? `${hauteur}px` : hauteur);

  // Recherche
  const searchContainer = container.append("div")
    .style("position", "absolute").style("top", "15px").style("left", "15px").style("z-index", "1000")
    .style("display", "flex").style("align-items", "center").style("gap", "10px");

  const champ = (sel) => sel.style("background", "rgba(86, 86, 86, 0.9)").style("color", "#fff8e7").style("font-size", "14px");
  const searchInput = champ(searchContainer.append("input"))
    .attr("type", "text").attr("placeholder", "Rechercher un point...").attr("aria-label", "Rechercher un point du graphe")
    .style("padding", "10px").style("width", "200px").style("border", "none").style("border-bottom", "2px solid #ffc536");
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

  // Recherche : Entrée pour chercher, flèches pour passer d'un résultat à l'autre
  let currentMatches = [];
  let currentIndex = 0;

  function updateNavigation() {
    const visible = currentMatches.length > 0;
    resultCounter.style("display", visible ? "block" : "none").text(`${currentIndex + 1}/${currentMatches.length}`);
    navButtons.style("display", visible ? "flex" : "none");
  }
  function reinitialiser() {
    node.selectAll("circle").transition().duration(300).attr("stroke", "none").attr("stroke-width", 0);
  }
  function highlightCurrentNode() {
    node.selectAll("circle").transition().duration(300)
      .attr("stroke", (d) => (currentMatches.includes(d) ? "#e7eeff" : "none"))
      .attr("stroke-width", (d) => (currentMatches.includes(d) ? 2 : 0));
    if (!currentMatches.length) return;
    const cible = currentMatches[currentIndex];
    node.filter((d) => d === cible).selectAll("circle").transition().duration(300).attr("stroke", "#ffffff").attr("stroke-width", 4);
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.scale(2.5).translate(-cible.x, -cible.y));
  }
  const avancer = (pas) => () => {
    if (!currentMatches.length) return;
    currentIndex = (currentIndex + pas + currentMatches.length) % currentMatches.length;
    updateNavigation();
    highlightCurrentNode();
  };
  btnUp.on("click", avancer(-1));
  btnDown.on("click", avancer(1));

  searchInput.on("keydown", function (event) {
    if (event.key !== "Enter" || !this.value) return;
    const terme = this.value.toLowerCase();
    currentMatches = nodes.filter((d) => d.id.toLowerCase().includes(terme));
    currentIndex = 0;
    updateNavigation();
    if (currentMatches.length) highlightCurrentNode();
    else reinitialiser();
  });
  searchInput.on("input", function () {
    if (this.value !== "") return;
    reinitialiser();
    svg.transition().duration(1000).call(zoom.transform, d3.zoomIdentity);
    currentMatches = [];
    currentIndex = 0;
    updateNavigation();
  });

  return Object.assign(container.node(), {scales: {color}});
}
