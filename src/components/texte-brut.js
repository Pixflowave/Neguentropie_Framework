// Bibliographie en texte brut (scan, copier-coller) → CSL-JSON.
//
// Style visé, courant dans l'édition française en sciences humaines,
// une référence par ligne :
//   A. Nom et B. Nom, Titre du livre, Ville, Éditeur, 2015.
//   A. Nom, « Titre de l'article », Revue, vol. 5, n° 3, 2017, p. 44-53.
//   A. Nom, « Titre du chapitre », in Titre de l'ouvrage, Ville, Éditeur, 1993.
//   A. Nom, « Titre », Journal, 8 mai 2020 : https://…
//
// Principe : rien n'est corrigé en silence. Chaque correction du
// pré-nettoyage et chaque doute de l'analyse sont renvoyés pour être
// affichés. Tests : npm run test:convertisseur

// ---------------------------------------------------------------------------
// 1. Pré-nettoyage
// ---------------------------------------------------------------------------

// Corrections d'erreurs de lecture fréquentes (OCR). [motif, remplacement, raison]
const CORRECTIONS = [
  [/(^|\s)\]\.\s/g, "$1J. ", "« ]. » lu pour « J. »"],
  [/\b[xX]{2}(?:r|\/-|l)(?=\s|$|[.,])/g, "XXIe", "siècle mal lu (XXIe)"],
  [/(?<![\w-])Al(?![\w-])/g, "AI", "« Al » lu pour « AI »"],
  [/\bOpenAl\b/g, "OpenAI", "« OpenAl » lu pour « OpenAI »"],
  [/\(III\.\)/g, "(Ill.)", "« (III.) » lu pour « (Ill.) »"],
  [/\b(\d{1,2})°\s(année|siècle)/g, "$1e $2", "« ° » lu pour « e »"],
  [/\bSth\b/g, "5th", "« Sth » lu pour « 5th »"],
  [/\((\d{4})\]/g, "($1)", "crochet fermant au lieu d'une parenthèse"],
  [/,\s*,/g, ",", "virgule en double"],
  [/https?:\/\/\s+/g, (m) => m.replace(/\s+/g, ""), "espace dans une adresse"],
  [/\s*\(lire en ligne \[archive\]\)/g, "", "mention « lire en ligne [archive] »"]
];

// Une adresse : on corrige l'hôte (toujours en minuscules) et les
// domaines de premier niveau mal lus.
function corrigerAdresse(url) {
  const m = url.match(/^(https?:\/\/)([^/]+)(.*)$/);
  if (!m) return url;
  let hote = m[2].replace(/I/g, "l").toLowerCase();
  hote = hote.replace(/\.ft$/, ".fr");
  return m[1] + hote + m[3];
}

// Deux références collées : « …, 2007.B. Stiegler, … ». Le point final est
// précédé de deux minuscules ou chiffres, et suivi sans espace d'une initiale.
const COLLEES = /(?<=[0-9a-zà-ÿ)\]»"]{2})\.(?=[A-ZÀ-Ý]\.(?:-?[A-ZÀ-Ý]\.)?\s?[A-ZÀ-Ý][a-zà-ÿ])/g;

// Mots coupés en fin de ligne (« intelli-gence ») : impossibles à distinguer
// sûrement des mots composés, donc seulement signalés.
const COMPOSES_FIN = new Set(["même", "mêmes", "ci", "là", "coureur", "office", "to", "peer", "based", "like", "être", "clés", "clé", "faire", "unis", "uns", "unes", "enfants", "up", "tech"]);
const COMPOSES_DEBUT = new Set(["avant", "après", "sous", "non", "anti", "peer", "back", "néo", "auto", "contre", "elle", "lui", "eux", "soi", "porte", "vis", "c'est", "est", "peut", "dit", "bien", "mal", "demi", "semi", "quasi", "ex", "post", "pré", "co", "e"]);

/**
 * @returns {lignes: [{n, texte}], corrections: [{n, avant, apres, raison}], coupures: [{n, mot}]}
 * `n` est le numéro de ligne dans le texte collé.
 */
export function nettoyerTexte(texte) {
  const lignes = [];
  const corrections = [];
  const coupures = [];

  // Vocabulaire du texte entier : un mot coupé (« intelli-gence ») est
  // recollé quand le mot entier apparaît ailleurs dans le texte.
  const source = String(texte ?? "");
  const vocabulaire = new Set(source.toLowerCase().match(/\p{L}+/gu) ?? []);
  const hotes = new Set([...source.matchAll(/https?:\/\/([^/\s]+)/g)].map((m) => m[1].toLowerCase()));

  source.split(/\r?\n/).forEach((brute, i) => {
    const n = i + 1;
    let t = brute.replace(/\s+/g, " ").trim();
    if (!t) return;

    for (const [motif, remplacement, raison] of CORRECTIONS) {
      const avant = t;
      t = t.replace(motif, remplacement);
      if (t !== avant) corrections.push({n, avant: extrait(avant, t), apres: extrait(t, avant), raison});
    }
    const avantUrl = t;
    t = t.replace(/https?:\/\/[^\s]+/g, corrigerAdresse);
    if (t !== avantUrl) corrections.push({n, avant: extrait(avantUrl, t), apres: extrait(t, avantUrl), raison: "adresse mal lue"});

    // Mots coupés, hors adresses
    t = t.split(/(https?:\/\/\S+)/).map((morceau) => {
      if (/^https?:\/\//.test(morceau)) {
        // adresse : recoller l'hôte s'il existe ailleurs sans tiret
        return morceau.replace(/^(https?:\/\/)([^/]+)/, (tout, proto, hote) => {
          if (!hote.includes("-")) return tout;
          for (let k = hote.indexOf("-"); k >= 0; k = hote.indexOf("-", k + 1)) {
            const recolle = hote.slice(0, k) + hote.slice(k + 1);
            if (hotes.has(recolle)) {
              corrections.push({n, avant: hote, apres: recolle, raison: "adresse coupée (hôte connu ailleurs dans le texte)"});
              return proto + recolle;
            }
          }
          return tout;
        });
      }
      return morceau.replace(/(?<![\p{L}-])(\p{Ll}[\p{Ll}']{1,})-(\p{Ll}{2,})(?![\p{L}-])/gu, (mot, a, b) => {
        if (COMPOSES_DEBUT.has(a) || COMPOSES_FIN.has(b)) return mot;
        if (vocabulaire.has((a + b).toLowerCase())) {
          corrections.push({n, avant: mot, apres: a + b, raison: "mot coupé (mot entier présent ailleurs dans le texte)"});
          return a + b;
        }
        coupures.push({n, mot});
        return mot;
      });
    }).join("");

    const morceaux = t.split(COLLEES).map((s) => s.trim()).filter(Boolean);
    if (morceaux.length > 1) {
      corrections.push({n, avant: `${morceaux.length} références sur une ligne`, apres: "séparées", raison: "références collées"});
      morceaux.forEach((m, k) => lignes.push({n, texte: k < morceaux.length - 1 ? m + "." : m}));
    } else {
      lignes.push({n, texte: t});
    }
  });

  return {lignes, corrections, coupures};
}

// Le passage qui diffère entre a et b, avec un peu de contexte.
function extrait(a, b) {
  let d = 0;
  while (d < a.length && a[d] === b[d]) d++;
  let fa = a.length, fb = b.length;
  while (fa > d && fb > d && a[fa - 1] === b[fb - 1]) { fa--; fb--; }
  return a.slice(Math.max(0, d - 12), Math.min(a.length, fa + 12));
}

// ---------------------------------------------------------------------------
// 2. Analyse d'une référence
// ---------------------------------------------------------------------------

const MAJ = "A-ZÀ-ÝŁŚŻ";
const INITIALES = `[${MAJ}]\\.(?:\\s?-?[${MAJ}]\\.)*`;
const PARTICULE = `(?:(?:de|da|du|des|von|van|der|den|Von|Van|Le|La|De|Da|Di|Du|D')\\s)`;
const MOT_NOM = `[${MAJ}][\\p{L}'’-]+`;
const NOM = `${PARTICULE}*${MOT_NOM}(?:\\s(?:de\\s)?${MOT_NOM}(?=,|\\s(?:et|and|&)\\s|\\s\\(dir|\\s«|\\s"))?`;
const AUTEUR = new RegExp(`^(${INITIALES})\\s?(${NOM})(\\s\\(dir\\.?\\))?`, "u");
const SEPARATEUR = /^(?:,\sand\s|,\set\s|,\s|\set\s|\sand\s|\s&\s)/;
const ET_AL = /^\set\sal\.?/;

const VILLES = new Set([
  "Paris", "Lyon", "Londres", "London", "Chicago", "Chicago (Ill.)", "Boston", "Oxford", "Cambridge", "Princeton", "Princeton, NJ",
  "New York", "Harvard", "Yale", "Bordeaux", "Limoges", "Bry-sur-Marne", "Baltimore", "Genève", "Bruxelles", "Montréal",
  "Lausanne", "Marseille", "Toulouse", "Grenoble", "Rennes", "Lille", "Nanterre", "Caen", "Berlin", "Amsterdam", "Québec",
  "Nantes", "Strasbourg", "Montpellier", "Nice", "Dijon", "Lormont", "Arles", "Neuchâtel", "Namur", "Liège", "Bâle",
  "Cambridge (Mass.)", "Cambridge, MA", "Stanford", "Berkeley", "Los Angeles", "San Francisco", "Philadelphie", "Rome", "Milan"
]);

const ANNEE = /\b(1[5-9]\d{2}|20\d{2})\b/g;
const SEGMENT_NUMERO = /^(?:(?:[Vv]ol|[Vv]o|[Nn]o|[Nn]r|[Nn]|[Pp]p|[Pp]|[Tt]ome|[Tt])(?:\.\s?|\s)|[Nn]°\s?)(?:\d|[IVXL]+\b)/;
const MENTION = /^(?:eds?\.|éds?\.|dir\.|trad\.|\(dir)/i;
// « 2017 », « 8 mai 2020 », « March 22nd 2023 », « Spring 2022 », « 2016/5 (n° 192) »
const DATE = /^(?:(?:\d{1,2}(?:st|nd|rd|th|er)?\s)?\p{L}+\s(?:\d{1,2}(?:st|nd|rd|th)?\s)?)?(?:1[5-9]|20)\d{2}\b/u;

/** Lit les auteurs en tête de ligne. Renvoie {auteurs, etAl, dir, reste}. */
export function lireAuteurs(texte) {
  const auteurs = [];
  let reste = texte;
  let etAl = false;
  let dir = false;
  for (;;) {
    const m = reste.match(AUTEUR);
    if (!m) break;
    auteurs.push({given: m[1].replace(/\s+/g, " ").trim(), family: m[2].trim()});
    if (m[3]) dir = true;
    reste = reste.slice(m[0].length);
    if (ET_AL.test(reste)) { etAl = true; reste = reste.replace(ET_AL, ""); break; }
    const s = reste.match(SEPARATEUR);
    if (!s || !AUTEUR.test(reste.slice(s[0].length))) break;
    reste = reste.slice(s[0].length);
  }
  reste = reste.replace(/^\s*\(dir\.?\)/, () => { dir = true; return ""; });
  return {auteurs, etAl, dir, reste: reste.replace(/^[\s,]+/, "")};
}

// Titre entre guillemets en tête : « … », "…", “…”. Tolère un guillemet
// fermant manquant ou mal lu (').
function lireTitreCite(reste) {
  const ouvrant = reste[0];
  const fermants = {"«": ["»"], '"': ['"', "”"], "“": ["”", '"']}[ouvrant];
  if (!fermants) return null;
  let fin = -1;
  for (const f of fermants) {
    const k = reste.indexOf(f, 1);
    if (k > 0 && (fin < 0 || k < fin)) fin = k;
  }
  // « …Investigation', 2021 » : apostrophe mal lue pour un guillemet,
  // mais seulement suivie d'une virgule (pas « Prisoner's », « aren't »)
  if (fin < 0 && ouvrant === '"') {
    const k = reste.search(/'(?=,|\s*$)/);
    if (k > 0) fin = k;
  }
  if (fin < 0) {
    // pas de guillemet fermant : le titre s'arrête à la première virgule
    const k = reste.indexOf(", ", 1);
    fin = k > 0 ? k : reste.length;
    return {titre: reste.slice(1, fin).trim(), suite: reste.slice(fin), doute: "guillemet fermant manquant"};
  }
  return {titre: reste.slice(1, fin).trim(), suite: reste.slice(fin + 1)};
}

function sansPointFinal(s) {
  return s.replace(/[\s.,;:]+$/, "").trim();
}

/**
 * Analyse une ligne. Renvoie {entree (CSL), doutes: [texte]}.
 */
export function analyserReference(ligne) {
  const doutes = [];
  let texte = ligne.trim();

  // Adresse en fin de ligne, avec « (en ligne) : » ou « : » avant.
  let url = "";
  const mu = texte.match(/\s*(?:\(en ligne\)\s*)?:?\s*(https?:\/\/\S+)\s*\.?\s*$/);
  if (mu) {
    url = mu[1].replace(/[.,;)]+$/, "");
    texte = texte.slice(0, mu.index);
  }
  texte = texte.replace(/\s*\(en ligne\)\s*$/, "");

  // Auteurs
  let {auteurs, etAl, dir, reste} = lireAuteurs(texte);
  let auteurCollectif = "";
  if (auteurs.length === 0) {
    // Pas d'initiale en tête : institution avant un titre cité
    // (« Conseil national du numérique, « … » ») ou rien.
    const q = reste.search(/[«"“]/);
    if (q > 0) {
      const avant = reste.slice(0, q).replace(/[\s,]+$/, "");
      const dedans = avant.match(new RegExp(`(?:^|,\\s)(${INITIALES}\\s?${NOM}.*)$`, "u"));
      if (dedans) {
        auteurCollectif = avant.slice(0, dedans.index).trim();
        auteurs = lireAuteurs(dedans[1]).auteurs;
        reste = reste.slice(q);
      } else if (!avant.includes(", ")) {
        auteurCollectif = avant;
        reste = reste.slice(q);
      }
      // sinon (« Livre blanc…, Focus « … » ») : pas d'auteur, lu comme un livre
    }
  }
  if (etAl) doutes.push("« et al. » : seuls les premiers auteurs sont connus");
  if (auteurs.length === 0 && !auteurCollectif) doutes.push("aucun auteur reconnu");

  const entree = {};
  let titre = "";
  let suite = "";

  const cite = lireTitreCite(reste);
  if (cite) {
    titre = cite.titre;
    suite = cite.suite;
    if (cite.doute) doutes.push(cite.doute);
  } else {
    suite = reste;
  }

  // Années : la dernière année plausible de la référence (hors pages et numéros)
  const sansPages = suite
    .replace(/\bpp?\.\s?\d+\s?[-–]\s?\d+/g, " ")
    .replace(/\b(?:n°|no|n|nr)\.?\s?\d+/gi, " ")
    .replace(/\bvol\.?\s?\d+/gi, " ");
  const annees = [...sansPages.matchAll(ANNEE)].map((m) => Number(m[1]));
  const anneeTitre = titre ? [...titre.matchAll(ANNEE)] : [];
  let annee = annees.length ? annees[annees.length - 1] : null;

  // Date d'origine entre parenthèses : « Titre (1958) », « » (1954) »
  const reOrigine = /\s*\((\d{4})(?:\s?[-–]\s?\d{4})?\)/;
  if (cite) {
    suite = suite.replace(/^[\s.,;:]+/, " ");
    const mo = suite.match(new RegExp(`^${reOrigine.source}`));
    if (mo) { entree["original-date"] = {"date-parts": [[Number(mo[1])]]}; suite = suite.slice(mo[0].length); }
    // « (trad. Y. Citton) » et autres mentions entre parenthèses
    suite = suite.replace(/^[\s.,;:]*\([^)]*\)/, "").replace(/^[\s.,;:]+/, "");
  }

  const segments = suite.split(/,\s/).map((s) => s.trim()).filter(Boolean);

  if (cite) {
    // Article ou chapitre
    const mIn = suite.match(/^[\s,]*in\s+(.+)$/i);
    if (mIn) {
      entree.type = "chapter";
      // « in A. Gorz, Le Fil rouge… » : auteur de l'ouvrage en tête
      const dansOuvrage = lireAuteurs(mIn[1]);
      const segs = (dansOuvrage.auteurs.length ? dansOuvrage.reste : mIn[1]).split(/,\s/).map((x) => x.trim()).filter(Boolean);
      const ouvrage = [];
      let k = 0;
      for (; k < segs.length; k++) {
        if (MENTION.test(segs[k]) || VILLES.has(sansPointFinal(segs[k])) || SEGMENT_NUMERO.test(segs[k]) || DATE.test(segs[k])) break;
        ouvrage.push(segs[k]);
      }
      if (ouvrage.length > 1 && k === segs.length) {
        // ni ville ni année : le dernier segment est sans doute l'éditeur
        entree.publisher = sansPointFinal(ouvrage.pop());
      }
      entree["container-title"] = sansPointFinal(ouvrage.join(", ").replace(/\s*\(\d{4}\)$/, ""));
      let fin = segs.slice(k).filter((x) => !SEGMENT_NUMERO.test(x) && !DATE.test(x) && !/^\d/.test(x));
      const iMention = fin.findIndex((x) => MENTION.test(x));
      if (iMention >= 0) {
        // « eds. H. W. Kuhn, A. W. Tucker » : sauter les noms qui suivent
        fin = fin.slice(iMention + 1).filter((x) => !new RegExp(`^${INITIALES}`, "u").test(x));
      }
      const {publisher, place} = editeurEtVille(fin);
      if (publisher) entree.publisher = publisher;
      if (place) entree["publisher-place"] = place;
    } else {
      // revue : segments qui suivent le titre, jusqu'au premier numéro ou date
      const utile = (x) => !SEGMENT_NUMERO.test(x) && !/^\d/.test(x) && !DATE.test(x);
      const debut = segments.findIndex(utile);
      const revue = [];
      if (debut >= 0) for (let k = debut; k < segments.length && utile(segments[k]); k++) revue.push(segments[k]);
      if (revue.length) entree["container-title"] = sansPointFinal(revue.join(", ").replace(/\s*(?:\d+\s?\(\d+\)|\d+)$/, ""));
      entree.type = entree["container-title"] ? "article-journal" : url ? "webpage" : "article";
    }
  } else {
    // Livre : Titre[, Collection], Ville, Éditeur, Année
    let segs = segments.slice();
    // retirer, à partir de la fin, l'édition, l'année et les numéros
    while (segs.length > 1) {
      const der = segs[segs.length - 1];
      if (/^\d+\S*\s?éd\.?$/i.test(der) || /^(?:(?:\d{1,2}\s)?\p{L}+\s)?(1[5-9]|20)\d{2}\.?$/u.test(der) || SEGMENT_NUMERO.test(der)) segs.pop();
      else break;
    }
    const numeros = segments.filter((s) => SEGMENT_NUMERO.test(s));
    if (numeros.length) {
      // pas de guillemets mais vol./n°/p. : article dont le titre n'est pas cité
      entree.type = "article-journal";
      entree["container-title"] = sansPointFinal(segs.pop() ?? "");
      titre = segs.join(", ");
      doutes.push("titre d'article sans guillemets");
    } else if (segs.length >= 2) {
      entree.type = "book";
      const {publisher, place, nb} = editeurEtVille(segs.slice(-2));
      const garde = segs.length - nb;
      if (publisher) entree.publisher = publisher;
      if (place) entree["publisher-place"] = place;
      let titreSegs = segs.slice(0, garde);
      if (!place && titreSegs.length > 1 && /\b(series|collection|coll\.)/i.test(titreSegs[titreSegs.length - 1])) {
        entree["collection-title"] = titreSegs.pop();
      }
      titre = titreSegs.join(", ");
      if (!place && titreSegs.length > 1) doutes.push("pas de ville reconnue : la fin du titre est peut-être l'éditeur");
    } else {
      titre = segs.join(", ");
      entree.type = url ? "webpage" : "book";
    }
    // « Titre (1958) » : date de première parution
    const mt = titre.match(new RegExp(`${reOrigine.source}\\s*$`));
    if (mt) { entree["original-date"] = {"date-parts": [[Number(mt[1])]]}; titre = titre.slice(0, mt.index); }
  }

  titre = sansPointFinal(titre);
  if (!titre) doutes.push("titre introuvable");
  else if (new RegExp(`^${INITIALES}\\s`, "u").test(titre)) doutes.push("le titre commence par une initiale : auteur mal lu ?");
  if (!annee && anneeTitre.length === 0) doutes.push("pas d'année");
  if (!annee && entree["original-date"]) annee = entree["original-date"]["date-parts"][0][0];

  if (titre) entree.title = titre;
  if (auteurs.length) entree.author = auteurs;
  else if (auteurCollectif) entree.author = [{literal: auteurCollectif}];
  if (dir) entree.note = "dir.";
  if (annee) entree.issued = {"date-parts": [[annee]]};
  if (url) entree.URL = url;
  const mp = suite.match(/\bpp?\.\s?(\d+\s?[-–]\s?\d+)/);
  if (mp) entree.page = mp[1].replace(/\s/g, "").replace("–", "-");
  const mv = suite.match(/\bvol\.?\s?([\dIVXL]+)/i);
  if (mv) entree.volume = mv[1];

  return {entree, doutes};
}

// Parmi les derniers segments d'un livre, trouve l'éditeur et la ville.
// Renvoie aussi le nombre de segments consommés (nb).
function editeurEtVille(segs) {
  const s = segs.map(sansPointFinal).filter(Boolean);
  if (s.length === 0) return {nb: 0};
  if (s.length >= 2 && VILLES.has(s[s.length - 2])) {
    return {place: s[s.length - 2], publisher: s[s.length - 1], nb: 2};
  }
  // « Cambridge-Harvard University Press » : ville collée à l'éditeur
  const colle = s[s.length - 1].match(/^([\p{L}-]+?)-(\p{Lu}.*(?:Press|Presses|Éditions|Editions).*)$/u);
  if (colle && VILLES.has(colle[1])) return {place: colle[1], publisher: colle[2], nb: 1};
  if (VILLES.has(s[s.length - 1])) return {place: s[s.length - 1], nb: 1};
  return {publisher: s[s.length - 1], nb: 1};
}

// ---------------------------------------------------------------------------
// 3. Texte entier
// ---------------------------------------------------------------------------

/**
 * @returns {entrees: CSL[], lignes: [{n, texte, entree, doutes}], corrections, coupures}
 * Les entrées gardent l'ordre des lignes. Une ligne sans titre n'est pas
 * transformée en entrée, mais reste listée avec ses doutes.
 */
export function texteVersCSL(texte) {
  const {lignes, corrections, coupures} = nettoyerTexte(texte);
  const resultats = lignes.map(({n, texte}) => ({n, texte, ...analyserReference(texte)}));
  return {
    entrees: resultats.filter((r) => r.entree.title).map((r) => r.entree),
    lignes: resultats,
    corrections,
    coupures
  };
}
