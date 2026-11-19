// Intègre Raleway (OFL, fichiers de polices/) en base64 :
// - src/raleway.css, importée par src/style.css (Framework ne sait pas copier
//   un fichier .woff2 référencé dans le CSS) ;
// - la vue 3D src/enveloppe-3d-viewer.html, entre les marqueurs raleway:debut/fin.
// Usage : npm run police
import {readFileSync, writeFileSync} from "node:fs";

const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

function fontFace(style) {
  const b64 = readFileSync(`polices/raleway-latin-wght-${style}.woff2`).toString("base64");
  return `@font-face{font-family:Raleway;font-style:${style};font-display:swap;font-weight:100 900;` +
    `src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${LATIN}}`;
}

const entete = "/* Raleway, SIL Open Font License 1.1 (polices/OFL.txt). Fichier généré par npm run police : ne pas modifier. */\n";
writeFileSync("src/raleway.css", entete + fontFace("normal") + "\n" + fontFace("italic") + "\n");

const vue = "src/enveloppe-3d-viewer.html";
const html = readFileSync(vue, "utf8");
const bloc = `<!-- raleway:debut --><style>${fontFace("normal")}</style><!-- raleway:fin -->`;
const motif = /<!-- raleway:debut -->.*?<!-- raleway:fin -->/s;
if (!motif.test(html)) throw new Error(`marqueurs raleway absents de ${vue}`);
writeFileSync(vue, html.replace(motif, bloc));
console.log("src/raleway.css et la vue 3D sont à jour.");
