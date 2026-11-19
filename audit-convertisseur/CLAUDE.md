# Audit du convertisseur bibliographique (2026-11-19)

Page : [src/bibliographie-converter.md](../src/bibliographie-converter.md) (https://framework.neguentropie.art/bibliographie-converter).
Modules : [src/components/bibliography-verifier.js](../src/components/bibliography-verifier.js) (recherche dans les catalogues) et [src/components/bibcheck-enhanced.js](../src/components/bibcheck-enhanced.js) (format, doublons, rétractations, hallucinations).
Données : [src/data/neguentropie_Graph.json](../src/data/neguentropie_Graph.json), le même fichier que le graphe de l'accueil. Le JSON fusionné est téléchargé, puis remplace ce fichier à la main.

Ce dossier est hors de `src/` exprès : Framework publierait tout fichier `.md` placé dans `src/` comme une page du site.

Rien n'a encore été corrigé. Cocher chaque point une fois corrigé et vérifié, avec la date et le commit.

## Règles pour les corrections

- Répondre en français. Commit local à chaque étape, push seulement avec l'accord d'Erwan, une fois le lot terminé.
- Le principe : **ne jamais modifier les données de l'utilisateur sans le montrer**. Toute entrée écartée, renommée ou rattachée à un nœud existant doit apparaître dans un aperçu avant le téléchargement.
- Vérifier chaque correction sur les cas de test listés ci-dessous (résultats obtenus le 2026-11-19, avant correction).
- Les numéros de ligne datent de l'audit. Ils bougeront.

## 🔴 Critique : le graphe peut être corrompu

- [ ] **1. Un résultat incertain remplace les données.** `verifyEntry` renvoie un résultat même avec une confiance faible (`status: 'uncertain'`, verifier.js:785-789). La fusion l'utilise sans regarder le statut (converter.md:515 et :730, `verifiedData.found` vaut toujours `true`). L'option « données vérifiées » est cochée par défaut. La confiance ne compare que les titres, jamais l'auteur.
  - Cas : Piketty, « Le capital au XXIe siècle », rapproché à 22 % de « Capitalism and Freedom ». Résultat actuel : nœuds « Capitalism and Freedom » et « Milton Friedman », reliés à Technè. Attendu : données d'origine conservées.
  - Correction : n'utiliser que `status === 'verified'`, et exiger aussi la correspondance de l'auteur.
- [ ] **2. `cleanTitle` sert à la fois à la recherche et à nommer les nœuds** (converter.md:736, :785). Il coupe les sous-titres, les parenthèses et les tomes.
  - Cas : « La technique et le temps, tome 2 » et « …, tome 3 » deviennent tous deux « La technique et le temps, » (un seul nœud, virgule en trop) ; « Capital: Critique of Political Economy » devient « Capital ».
  - Correction : garder le titre d'origine comme identifiant, et réserver `cleanTitle` aux requêtes.
- [ ] **3. Des entrées disparaissent sans message.** Un titre fait de mots à majuscule, sans année ni URL, est jeté comme « liste de noms » (regex de converter.md:816).
  - Cas : « Silent Spring » (Rachel Carson) donne 0 nœud.
  - Correction : compter et afficher les entrées écartées, avec la raison.
- [ ] **4. Les auteurs peuvent être rattachés au titre d'une œuvre.** `findMatchingNode` (converter.md:567-598) compare l'auteur à tous les nœuds, œuvres comprises, et le premier nœud trouvé l'emporte.
  - Cas : l'auteur « P. Stiegler » est rattaché à « Penser avec Bernard Stiegler ».
  - Autre défaut : les titres ne sont comparés qu'à l'identique. Cas : « La Gouvernance par les nombres » (avec une majuscule) crée un doublon de « La gouvernance par les nombres ».
  - Correction : ne comparer qu'aux nœuds qui sont des personnes (source d'une arête Livre, Article, Individu…) et comparer les titres sans casse ni accents. En cas d'ambiguïté, le signaler dans l'aperçu plutôt que de choisir.

## 🟠 Vérification peu fiable

- [ ] **5. Les rétractations sont lues au mauvais endroit** (bibcheck-enhanced.js:294). Le code lit `update-to`, mais Crossref publie les rétractations dans `updated-by` (`type: "retraction"`, `source: "retraction-watch"`) ; `update-to` figure sur l'avis lui-même, donc un erratum serait compté comme une rétractation.
  - Vérifié sur l'article de Wakefield, `10.1016/S0140-6736(97)11096-0` : `update-to` absent, `updated-by` contient une correction (2004) et une rétractation (2010). Il n'est détecté aujourd'hui que grâce au « RETRACTED: » de son titre.
  - Le mot-clé `correction` (ainsi que `withdrawn`, `erratum`) dans un titre suffit à déclarer l'article rétracté (lignes 347-367) : faux positifs sur des titres français.
  - Encoder le DOI dans l'adresse (`encodeURIComponent`).
- [ ] **6. La 3ᵉ méthode de détection des rétractations ne s'exécute jamais** (bibcheck-enhanced.js:373) : `extractLastName` reçoit le tableau d'auteurs CSL au lieu d'un texte. L'erreur `authorString.split is not a function` est interceptée en silence.
- [ ] **7. Une apostrophe fait échouer la requête SPARQL de la BnF** (verifier.js:634-638). `cleanForSparql` ne retire que les guillemets doubles.
  - Cas réel : « L'obsolescence de l'homme » donne une erreur 500 de Virtuoso (`XM029 syntax error`). La requête « La technique et le temps » + « Stiegler » ne renvoie aucun résultat.
  - Revoir la requête (échapper ou retirer `'`, chercher par mots plutôt que par phrase), et la tester sur une dizaine de titres français connus.
- [ ] **8. Le risque d'hallucination est compté deux fois et presque jamais affiché.**
  - Une référence introuvable reçoit +50 dans `detectHallucinationRisk`, puis encore +20 (converter.md:233-243), sans que son niveau soit recalculé : elle reste « moyen ». L'alerte « élevé » ne se déclenche presque jamais.
  - Quand elle se déclenche, elle affiche les mauvais titres : `.filter(...).map((h, i) => results[i])` (converter.md:356-359) utilise l'indice dans la liste filtrée.
  - L'alerte lit `h.reasons` au lieu de `h.warnings` : les vraies raisons ne s'affichent jamais.
  - `detectHallucinationRisk` reçoit l'entrée CSL brute : `entry.year` n'existe pas en CSL (`issued`).
- [ ] **9. Chaque frappe relance toute la vérification** (converter.md:146). Après un clic, le bouton garde la valeur `"verify"`, et la cellule dépend de `cslInput` (`submit: false`). Chaque entrée peut déclencher jusqu'à 8 requêtes.
  - Correction : prendre le texte au moment du clic (par exemple, un bouton dont `reduce` renvoie le contenu du champ).

## 🟡 Robustesse et code

- [ ] Heuristique « titre manquant récupéré dans les auteurs » en deux copies qui ont divergé (converter.md:84-144 et :681-707 ; la seconde a une condition `family.length > 20` en plus). En faire une seule fonction. `validateCSLFormat`, qui lit le CSL brut, signale « Titre manquant » même pour un titre récupéré.
- [ ] JSON qui n'est pas un tableau, ou entrée `null` : `cslData.map is not a function`, la page casse. Valider l'entrée une seule fois, avec un message clair.
- [ ] `_verification` est calculé (converter.md:495-512) mais jamais enregistré : seuls `id`, `url` et `year` passent dans le nœud. Le garder ou le supprimer.
- [ ] Année tantôt nombre, tantôt texte (la BnF renvoie parfois « DL 2015 ») : n'enregistrer que l'année sur 4 chiffres, en nombre.
- [ ] Le remplacement par les données vérifiées est fait deux fois (converter.md:515-527, puis :730-781). Le premier découpe l'auteur au dernier espace (« Stiegler, Bernard » devient `family: "Bernard"`).
- [ ] Code mort à supprimer :
  - `verifyBibliography` ;
  - `generateQualityReport`, `calculateQualityScore` ;
  - `searchCrossRefBibliographic`, `matchCriteria`, `buildRefString`, `findDOI`, `extractCrossRefInfo`, `partialRatio`, `uniformize` ;
  - les imports inutilisés en converter.md:64 ;
  - le commentaire d'en-tête obsolète de verifier.js (« Uses OpenLibrary API »).
- [ ] Environ 8 `console.log` par entrée côté BnF (verifier.js:525, 579-588, 683-697) : à retirer.
- [ ] Le score affiché (converter.md:307-318) et `calculateQualityScore` ne suivent pas la même formule. N'en garder qu'une.

## 🎨 Style (déjà signalé dans le CLAUDE.md principal)

- [ ] Classes utilisées mais jamais stylées : `.alert*`, `.alerts-container`, `.error-box`, `.stats-dashboard`, `.stat-verified`, `.stat-uncertain`, `.stat-notfound`.
- [ ] Classes stylées mais jamais utilisées : `.url-*`, `.quality-score-container`, `.empty-state*`.
- [ ] Dégradé violet → rouge, couleurs codées en dur et émojis : passer à la palette du site (`--theme-foreground-focus` or, `--theme-background-b`…). La page redéfinit aussi `h2`, `h3`, `pre` et `code` pour tout le site : à retirer.

## 🌱 Respect des services interrogés

Toutes les API répondent au navigateur (CORS `*` vérifié le 2026-11-19 : catalogue.bnf.fr, data.bnf.fr, HAL, Open Library, OpenAlex, Crossref).

- [ ] OpenAlex sans clé : tous les utilisateurs d'une même adresse IP partagent un budget de 0,10 $ par jour (message `meta.notice` de la réponse). Cela suffit pour un usage ponctuel. Ne pas mettre de clé dans le code publié.
- [ ] Crossref : ajouter `mailto=` pour entrer dans le « polite pool » (adresse à choisir avec Erwan, jamais une adresse personnelle sans son accord).
- [ ] Aucun délai entre les requêtes de rétractation, et aucun délai maximal hors SPARQL : ajouter un `AbortController` (environ 8 s) pour chaque requête.

## Graphe existant (état du 2026-11-19)

454 nœuds, 687 arêtes. Des traces de fusions passées :
- identifiants en double : « La projection de Lee et ses paper toys », « Critique de l'Intelligence Artificielle », « Baptiste Loreaux » ;
- quasi-doublon : « Penser l'humain et la technique Simondon et Derrida après la métaphysique », avec et sans « : » ;
- 5 arêtes en double (dont Daniel Ross → The Immense Regression, Anne Alombert → Critique de l'Intelligence Artificielle) ;
- 10 arêtes vers des nœuds absents : `art`, `musique`, `Logique`, `Logicien`, « Jaques Lacan », « ∏node », « Art », et deux vers « Critique de l'Intelligence Artificielle » écrit avec une autre apostrophe. Le chargeur [src/data/graphe-neguentropie.json.js](../src/data/graphe-neguentropie.json.js) les tolère en créant ces nœuds sans URL ;
- années : 10 en texte, 3 en nombre ; 11 nœuds sans URL.

Le nettoyage du graphe est un lot à part : demander à Erwan quelle version garder pour chaque doublon.

## Ordre de correction proposé

1. Points 1 à 4 : fusion sûre et aperçu des changements avant téléchargement.
2. Points 5 et 7 : rétractations et SPARQL.
3. Points 6, 8 et 9 : affichage du risque d'hallucination et déclenchement au clic.
4. Robustesse, code mort, style.
5. Nettoyage du graphe existant.
