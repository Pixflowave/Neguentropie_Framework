// Fusion d'une bibliographie CSL-JSON (AnyStyle) avec le graphe Néguentropie.
//
// Principe : ne jamais modifier les données sans le montrer. Tout ce qui est
// écarté, rapproché d'un nœud existant ou complété depuis un catalogue est
// noté dans `rapport`, que la page affiche avant le téléchargement.
// Tests : node scripts/test-convertisseur.mjs

import {retirerAuteurDuTitre, normaliserTexte} from "./bibliography-verifier.js";

// Types d'arête qui relient un auteur à son œuvre : leur source est une personne.
const TYPES_AUTEUR = new Set(["Livre", "Article", "Site Web", "Rapport", "Traduction", "Colloque"]);
// Types d'arête dont la cible est une personne.
const TYPES_PERSONNE = new Set(["Individu", "Contributeur·se"]);

const nomComplet = (a) =>
  !a ? "" : a.literal || (a.family ? (a.given ? `${a.given} ${a.family}` : a.family) : "");

/**
 * Titre de l'entrée. Quand il manque, AnyStyle l'a parfois rangé comme
 * dernier « auteur » : on le récupère s'il en a l'air (article en tête,
 * particule, nom de famille à espaces ou très long, rapport…).
 * Renvoie {titre, auteurs, recupere}.
 */
export function recupererTitre(entry) {
  let titre = typeof entry?.title === "string" ? entry.title : "";
  let auteurs = Array.isArray(entry?.author) ? entry.author.filter(Boolean) : [];
  let recupere = false;

  if (!titre.trim() && auteurs.length > 0) {
    const candidat = auteurs[auteurs.length - 1];
    const nom = nomComplet(candidat);
    const article = /^(The |Le |La |L'|L’|Les |Des |Un |Une )/i.test(nom);
    const rapport = /(Review|Rapport|Report|Commission)/i.test(nom);
    const forme = candidat.particle || (candidat.family && (candidat.family.includes(" ") || candidat.family.length > 20));
    if (forme || article || rapport) {
      titre = candidat.particle && candidat.family ? `${candidat.particle} ${candidat.family}` : nom;
      auteurs = auteurs.slice(0, -1);
      recupere = true;
    }
  }
  return {titre, auteurs, recupere};
}

/** Titre qui servira d'identifiant : complet, sans le nom d'auteur collé. */
export function titreNoeud(titre, auteurs = []) {
  const candidats = [];
  for (const a of auteurs) {
    if (a && typeof a === "object") candidats.push(a, nomComplet(a));
    else if (a) candidats.push(a);
  }
  return retirerAuteurDuTitre(titre, candidats)
    .replace(/\s+/g, " ")
    .replace(/[\s.,;:]+$/, "")
    .trim();
}

/** Année sur 4 chiffres, en nombre (« DL 2015 » → 2015), ou null. */
export function annee(valeur) {
  const m = String(valeur ?? "").match(/\b(1\d{3}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

/** Découpe un nom d'auteur qui en contient plusieurs (« S.Bichler J. Nitzan »). */
export function separerAuteurs(nom) {
  if (!nom) return [];
  if (nom.includes(";") || nom.includes(" & ") || nom.includes(" and ")) {
    return nom.split(/;| & | and /).map((n) => n.trim()).filter(Boolean);
  }
  if (nom.includes(",")) {
    const parts = nom.split(",").map((n) => n.trim()).filter(Boolean);
    if (parts.length > 2 || (parts.length === 2 && parts.every((p) => p.includes(" ")))) return parts;
    if (parts.length === 2) return [`${parts[1]} ${parts[0]}`]; // « Nom, Prénom »
  }
  const initiales = nom.match(/[A-ZÀ-Ý]\.(?:[- ][A-ZÀ-Ý]\.)?\s*[A-ZÀ-Ý][a-zà-ÿ]+/g);
  if (initiales && initiales.length > 1) return initiales;
  if (!nom.includes(".")) {
    const mots = nom.split(/\s+/);
    if (mots.length === 4 && mots.every((w) => /^[A-ZÀ-Ý]/.test(w))) {
      return [mots.slice(0, 2).join(" "), mots.slice(2).join(" ")];
    }
  }
  return [nom];
}

// « A. Nom », « A.Nom », « Prénom Nom » → {premier, nom, initiale}
function analyserNom(nom) {
  const colle = nom.match(/^([A-ZÀ-Ý])\.([A-ZÀ-Ý][a-zà-ÿ]+)$/);
  if (colle) return {premier: colle[1], nom: colle[2], initiale: true};
  const parts = nom.split(/\s+/);
  if (parts.length < 2) return null;
  const premier = parts.slice(0, -1).join(" ");
  return {premier, nom: parts[parts.length - 1], initiale: premier.length === 1 || premier.endsWith(".")};
}

/**
 * Cherche une personne du graphe qui correspond à `nom`.
 * Renvoie {id} (trouvée), {ambigu: [ids]} ou null.
 */
export function trouverPersonne(nom, tousLesIds, personnes) {
  if (tousLesIds.has(nom)) return {id: nom};
  const cle = normaliserTexte(nom);
  for (const id of personnes) if (normaliserTexte(id) === cle) return {id};

  const a = analyserNom(nom);
  if (!a || !a.initiale) return null; // deux prénoms complets différents : deux personnes
  const trouves = [];
  for (const id of personnes) {
    const b = analyserNom(id);
    if (!b || normaliserTexte(b.nom) !== normaliserTexte(a.nom)) continue;
    if (normaliserTexte(b.premier).charAt(0) === normaliserTexte(a.premier).charAt(0)) trouves.push(id);
  }
  if (trouves.length === 1) return {id: trouves[0]};
  if (trouves.length > 1) return {ambigu: trouves};
  return null;
}

function typeArete(type) {
  return type === "webpage" ? "Site Web" : type === "report" ? "Rapport" : type === "article-journal" ? "Article" : "Livre";
}

/**
 * @param cslText   texte CSL-JSON collé
 * @param graphe    {nodes, edges}
 * @param sourceId  nœud auquel rattacher les références (ou null)
 * @param verifications résultats de verifyEntry, même ordre que les entrées
 * @param completer compléter avec le catalogue (adresse, année, auteurs manquants)
 * @returns {nodes, edges, stats, rapport} ou {...graphe, error}
 */
export function mergeCSL(cslText, graphe, sourceId, verifications = [], completer = true) {
  if (!cslText || cslText.trim() === "") return graphe;

  let csl;
  try {
    csl = JSON.parse(cslText);
  } catch (e) {
    return {...graphe, error: "JSON invalide : " + e.message};
  }
  if (!Array.isArray(csl)) {
    return {...graphe, error: "Le JSON doit être une liste d'entrées CSL, entre crochets [ … ]."};
  }

  const g = JSON.parse(JSON.stringify(graphe));
  const ids = new Set(g.nodes.map((n) => n.id));
  const parTitre = new Map(g.nodes.map((n) => [normaliserTexte(n.id), n.id]));
  const personnes = new Set();
  for (const e of g.edges) {
    if (TYPES_AUTEUR.has(e.type)) personnes.add(e.source);
    if (TYPES_PERSONNE.has(e.type)) personnes.add(e.target);
  }
  const aretes = new Set(g.edges.map((e) => `${e.source}\u0000${e.target}`));

  const rapport = {oeuvres: [], auteurs: [], rapprochements: [], ecartees: [], avertissements: [], completees: []};
  let nouveauxNoeuds = 0;
  let nouvellesAretes = 0;

  const ajouterArete = (source, target, type) => {
    const cle = `${source}\u0000${target}`;
    if (aretes.has(cle)) return;
    aretes.add(cle);
    g.edges.push({source, target, type});
    nouvellesAretes++;
  };

  csl.forEach((entry, i) => {
    const n = i + 1;
    if (!entry || typeof entry !== "object") {
      rapport.ecartees.push({n, titre: "", raison: "Entrée vide ou mal formée"});
      return;
    }

    const {titre, auteurs: auteursCSL, recupere} = recupererTitre(entry);
    let titreFinal = titreNoeud(titre, auteursCSL);
    if (!titreFinal) {
      rapport.ecartees.push({n, titre: "", raison: "Titre manquant"});
      return;
    }
    if (recupere) rapport.avertissements.push({n, titre: titreFinal, message: "Titre retrouvé parmi les auteurs"});

    let url = typeof entry.URL === "string" ? entry.URL.trim() : "";
    let an = annee(entry.issued?.["date-parts"]?.[0]?.[0]);
    let auteurs = auteursCSL.flatMap((a) => separerAuteurs(nomComplet(a)));

    // Compléter depuis le catalogue : seulement une référence vérifiée,
    // et seulement ce qui manque. Le titre et les auteurs d'origine restent.
    const v = verifications?.[i];
    if (completer && v?.status === "verified" && v.verified) {
      const pris = [];
      if (!url && v.verified.url) { url = v.verified.url; pris.push("adresse"); }
      if (!an && annee(v.verified.year)) { an = annee(v.verified.year); pris.push("année"); }
      if (auteurs.length === 0 && v.verified.author) {
        auteurs = separerAuteurs(v.verified.author);
        pris.push("auteurs");
      }
      if (pris.length) rapport.completees.push({n, titre: titreFinal, source: v.verified.source, champs: pris.join(", ")});
    }

    // Titre qui n'est que la liste des auteurs (erreur d'analyse d'AnyStyle)
    if (!an && !url && auteurs.length) {
      const t = titreFinal.replace(/[,.]/g, "");
      if (t.length > 5 && auteurs.join(" ").replace(/[,.]/g, "").includes(t)) {
        rapport.ecartees.push({n, titre: titreFinal, raison: "Le titre ne contient que les noms des auteurs"});
        return;
      }
    }
    if (!an && !url && /^([A-ZÀ-Ý][a-zà-ÿ]+\s?){2,}$/.test(titreFinal)) {
      rapport.avertissements.push({n, titre: titreFinal, message: "Titre fait de mots à majuscule, sans année ni adresse : est-ce bien un titre ?"});
    }

    // Œuvre : réutiliser un nœud de même titre (casse, accents, ponctuation ignorés)
    const existant = parTitre.get(normaliserTexte(titreFinal));
    if (existant) {
      rapport.rapprochements.push({n, genre: "œuvre", saisi: titreFinal, noeud: existant});
      titreFinal = existant;
    } else {
      const noeud = {id: titreFinal, url};
      if (an) noeud.year = an;
      g.nodes.push(noeud);
      ids.add(titreFinal);
      parTitre.set(normaliserTexte(titreFinal), titreFinal);
      nouveauxNoeuds++;
      rapport.oeuvres.push({n, titre: titreFinal, annee: an ? String(an) : "", url}); // texte : pas de « 1,996 » dans le tableau
    }

    for (const nom of auteurs) {
      let id = nom;
      const trouve = trouverPersonne(nom, ids, personnes);
      if (trouve?.id) {
        id = trouve.id;
        if (id !== nom) rapport.rapprochements.push({n, genre: "auteur", saisi: nom, noeud: id});
      } else {
        if (trouve?.ambigu) {
          rapport.avertissements.push({n, titre: titreFinal, message: `« ${nom} » peut être ${trouve.ambigu.join(" ou ")} : nouveau nœud créé, à vérifier`});
        }
        if (!ids.has(nom)) {
          g.nodes.push({id: nom, url: ""});
          ids.add(nom);
          nouveauxNoeuds++;
          rapport.auteurs.push({n, nom});
        }
      }
      personnes.add(id);
      ajouterArete(id, titreFinal, typeArete(entry.type));
    }

    if (sourceId && sourceId !== titreFinal) ajouterArete(titreFinal, sourceId, "Référence");
  });

  return {...g, stats: {newNodes: nouveauxNoeuds, newEdges: nouvellesAretes, entrees: csl.length}, rapport};
}
