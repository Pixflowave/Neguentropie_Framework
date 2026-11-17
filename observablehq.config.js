// See https://observablehq.com/framework/config for documentation.
import MarkdownItFootnote from "markdown-it-footnote";
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
  // Police Raleway sur tout le site (texte courant, titres, menus, cartes)
  // Framework 1.13 écrit <html> sans langue : on déclare le français au chargement.
  head: `<script>document.documentElement.lang="fr"</script>
<link rel="icon" href="observable.png" type="image/png" sizes="32x32">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,400..800;1,400..800&display=swap">
<style>:root{--serif:Raleway,system-ui,sans-serif;--sans-serif:Raleway,system-ui,sans-serif}body{font-variant-numeric:lining-nums}</style>`,

  // The path to the source root.

  root: "src",
  markdownIt: (md) => md.use(MarkdownItFootnote),

  // Some additional configuration options and their defaults:
  // theme: "default", // try "light", "dark", "slate", etc.
  // header: "", // what to show in the header (HTML)
  // footer: "Built with Observable.", // what to show in the footer (HTML)
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
