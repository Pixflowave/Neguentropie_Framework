// See https://observablehq.com/framework/config for documentation.
import MarkdownItFootnote from "markdown-it-footnote";

// Adresses fixes pour les balises Open Graph (les fichiers du site ont une
// empreinte dans leur nom, l'image de partage est donc prise sur GitHub).
const SITE = "https://pixflowave.github.io/Neguentropie_Framework";
const IMAGE = "https://raw.githubusercontent.com/Pixflowave/Neguentropie_Framework/main/src/Neguentropie.png";
const DESCRIPTION = "Néguentropie, installation artistique sous Licence Art Libre : cartographie, construction collective et bifurcations.";
// Description de chaque page (Framework 1.13 ignore les champs inconnus de l'en-tête des pages).
const DESCRIPTIONS = {
  "/index": "Néguentropie, installation artistique sous Licence Art Libre : une invitation à la recherche du point gris, entre cartographie, construction collective et bifurcations.",
  "/neguanthropocene": "Néguanthropocène (2021) : une démarche participative pour interroger l'activité humaine et s'émanciper par le collectif.",
  "/Symposium_neguanthropique": "Symposium néguanthropique : quelles bifurcations ? Consultation ouverte et anonyme sur Pol.is, dans le prolongement de l'œuvre Néguentropie.",
  "/enveloppe-icosaedrique-3d": "Enveloppe icosaédrique de 3 750 m³ portant la carte Airocean : vue 3D de la montgolfière et carte des sites de vol autour de Cossonay.",
  "/bibliographie-converter": "Outil pour vérifier des bibliographies CSL-JSON (BnF, HAL, Crossref, Open Library) et les fusionner avec le graphe Néguentropie.",
  "/rencontres": "Rencontres, ateliers, résidences et publications de Néguentropie depuis 2021, dont l'article paru dans Cartes & Géomatique (2024)."
};
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
export default {
  // The app’s title; used in the sidebar and webpage titles.
  title: "Néguentropie",

  // The pages and sections in the sidebar. If you don’t specify this option,
  // all pages will be listed in alphabetical order. Listing pages explicitly
  // lets you organize them into sections and have unlisted pages.

  pages: [
    {
      name: "Bifurcations & Projets émergents",
      pages: [
        { name: "Néguanthropocène", path: "/neguanthropocene" },
        { name: "Symposium néguanthropique", path: "/Symposium_neguanthropique" },
        { name: "Enveloppe icosaédrique", path: "/enveloppe-icosaedrique-3d" },
        { name: "Convertisseur Bibliographie CSL-JSON", path: "/bibliographie-converter" }
      ]
    },
    { name: "Rencontres & Publications", path: "/rencontres" }
  ],

  // Content to add to the head of the page, e.g. for a favicon:
  // Commun à toutes les pages. Framework 1.13 écrit <html> sans langue : on
  // déclare le français au chargement. Description et Open Graph : voir
  // DESCRIPTIONS. Ne pas mettre de « head » dans l'en-tête d'une page : il
  // remplacerait celui-ci.
  head: ({title, path}) => {
    const titre = title ? `${title} · Néguentropie` : "Néguentropie";
    const description = DESCRIPTIONS[path] ?? DESCRIPTION;
    const url = SITE + path.replace(/(^|\/)index$/, "$1");
    return `<script>document.documentElement.lang="fr"</script>
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="icon" href="favicon.png" type="image/png" sizes="32x32">
<meta name="description" content="${attr(description)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Néguentropie">
<meta property="og:title" content="${attr(titre)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(url)}">
<meta property="og:image" content="${IMAGE}">
<meta property="og:image:width" content="1920">
<meta property="og:image:height" content="1080">
<meta property="og:image:alt" content="L'enveloppe icosaédrique Néguentropie, modélisée avec Blender">
<meta name="twitter:card" content="summary_large_image">`;
  },

  // Thème par défaut + Raleway hébergée dans le dépôt (src/style.css).
  // Pas de feuille globale : Framework chargerait sinon Source Serif 4 chez Google.
  style: "style.css",
  globalStylesheets: [],

  // The path to the source root.

  root: "src",

  // Modules publiés à adresse fixe, importables par d'autres sites (pixflowave.fr) :
  // https://pixflowave.github.io/Neguentropie_Framework/graphiques/graphe.js et lorenz.js
  dynamicPaths: ["/graphiques/graphe.js", "/graphiques/lorenz.js"],
  markdownIt: (md) => md.use(MarkdownItFootnote),

  // Some additional configuration options and their defaults:
  // theme: "default", // try "light", "dark", "slate", etc.
  // header: "", // what to show in the header (HTML)
  // Pied de page commun : outils libres qui font le site.
  footer: `Site réalisé avec <a href="https://observablehq.com/framework/">Observable Framework</a> (licence ISC) · graphiques <a href="https://observablehq.com/plot/">Observable Plot</a> et <a href="https://d3js.org/">D3</a> · cartes <a href="https://leafletjs.com/">Leaflet</a> · 3D <a href="https://threejs.org/">three.js</a> · police <a href="https://fonts.google.com/specimen/Raleway">Raleway</a> (OFL) · contenus sous <a href="https://artlibre.org">Licence Art Libre</a> sauf mention contraire.`,
  // sidebar: true, // whether to show the sidebar
  // toc: true, // whether to show the table of contents
  // pager: true, // whether to show previous & next links in the footer
  // output: "dist", // path to the output root for build
  search: true, // activate search
  // linkify: true, // convert URLs in Markdown to links
  // typographer: false, // smart quotes and other typographic improvements
  // preserveExtension: false, // drop .html from URLs
  // preserveIndex: false, // drop /index from URLs
};
