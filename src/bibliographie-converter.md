---
title: Convertisseur Bibliographie → JSON
toc: false
---

<div class="hero">
  <h1>📚 Convertisseur Bibliographie CSL-JSON</h1>
  <h2>Importez vos bibliographies au format CSL-JSON et fusionnez-les avec le graphique Néguentropie</h2>
</div>

<div class="converter-container">

## 🔄 Fusion CSL-JSON [AnyStyle.io](https://anystyle.io)

Importez un fichier CSL-JSON exporté depuis AnyStyle.io et fusionnez-le avec le graphe existant.

```js
// Import existing graph data
const graphData = FileAttachment("./data/neguentropie_Graph.json").json();
```

<div class="input-section">

### 1. Sélectionner le livre source
Choisissez le nœud du graphe existant qui sera la source des nouvelles références.

```js
const existingNodes = graphData.nodes.map(n => n.id).sort();
const selectedSourceBook = view(Inputs.select(existingNodes, {
  label: "Livre Source",
  placeholder: "Sélectionnez un livre...",
  value: existingNodes.find(n => n === "Technè") // Default or empty
}));
```

### 2. Coller le CSL-JSON
Collez le contenu de votre fichier JSON exporté.

```js
const cslInput = view(Inputs.textarea({
  placeholder: `[
  {
    "author": [
      {
        "family": "Stiegler",
        "given": "Bernard"
      }
    ],
    "title": "La technique et le temps",
    ...
  }
]`,
  rows: 10,
  width: "100%",
  submit: false
}));
```

### 🔍 Vérification CSL (optionnel)

Vérifiez les références avant de les fusionner.

```js
import {verifyBibliography, verifyEntry, calculateSimilarity, cleanTitle} from "./components/bibliography-verifier.js";
import {
  checkRetraction,
  detectHallucinationRisk,
  validateCSLFormat,
  detectDuplicates
} from "./components/bibcheck-enhanced.js";
```

```js
const verifyCSLButton = view(Inputs.button("🔍 Vérifier les références CSL", {
  value: null,
  reduce: () => "verify"
}));
```

```js
const cslVerificationTriggered = verifyCSLButton === "verify";

// Extract entries from CSL for verification
function extractCSLEntries(jsonText) {
  if (!jsonText || jsonText.trim() === "") return [];
  try {
    const data = JSON.parse(jsonText);
    return data.map(entry => {
      let title = entry.title;
      let authorsList = entry.author || [];
      
      // Heuristic for missing title recovery
      // If title is missing and we have authors, check if one might be the title
      if ((!title || title.trim() === "") && authorsList.length > 0) {
          // Check the last "author" entry (or the only one)
          const candidate = authorsList[authorsList.length - 1];
          
          // Construct full name to check for "The ...", "Le ...", etc.
          const candName = candidate.literal || (candidate.family ? (candidate.given ? `${candidate.given} ${candidate.family}` : candidate.family) : "");
          
          // Conditions to treat as title:
          // 1. Has explicit particle field
          // 2. Family has spaces ("Grande Transformation") -> Previous heuristic
          // 3. Full name starts with known article (The, Le, La, L', Des, Les)
          // 4. Contains "Review" or "Rapport" if it's the only element?
          
          const startsWithArticle = /^(The |Le |La |L'|Les |Des |Un |Une )/i.test(candName);
          const looksLikeReport = /(Review|Rapport|Report|Commission)/i.test(candName);
          
          if (candidate.particle || (candidate.family && candidate.family.includes(' ')) || startsWithArticle || looksLikeReport) {
              // It's likely a title
              title = candName;
              if (candidate.particle && candidate.family) {
                   title = `${candidate.particle} ${candidate.family}`;
              }
              
              // Remove this candidate from authors list
              authorsList = authorsList.slice(0, -1);
          }
      }

      let author = "";
      if (authorsList.length > 0) {
        const a = authorsList[0];
        if (a.literal) author = a.literal;
        else if (a.family) author = a.given ? `${a.given} ${a.family}` : a.family;
      }
      
      let year = "";
      if (entry.issued && entry.issued["date-parts"] && entry.issued["date-parts"][0]) {
        year = entry.issued["date-parts"][0][0];
      }

      return {
        title: title,
        author: author,
        year: year,
        originalUrl: entry.URL
      };
    });
  } catch (e) {
    return [];
  }
}

const cslVerificationResults = cslVerificationTriggered && cslInput
  ? (async function*() {
      let cslData;
      try {
        cslData = JSON.parse(cslInput);
      } catch (e) {
        yield { loading: false, data: [], error: "JSON invalide", metadata: null };
        return;
      }
      
      const total = cslData.length;
      if (total === 0) {
        yield { loading: false, data: [], metadata: null };
        return;
      }

      // Initial loading state
      yield { loading: true, progress: { current: 0, total }, message: "Initialisation..." };
      
      // 1. Validation du format
      const formatValidation = validateCSLFormat(cslData);
      
      // 2. Détection de doublons
      const duplicates = detectDuplicates(cslData);
      
      // 3. Vérification dans les bases de données (CrossRef + BnF + HAL + OpenLibrary)
      const entries = extractCSLEntries(cslInput);
      const verificationResults = [];

      for (let i = 0; i < total; i++) {
        const entry = entries[i];
        
        // Yield progress update
        yield { 
          loading: true, 
          progress: { current: i + 1, total }, 
          message: `Vérification (${i + 1}/${total}): ${entry?.title?.substring(0, 40) || 'Entrée'}...` 
        };
        
        // Handle invalid entries
        if (!entry || !entry.title) {
            verificationResults.push({ original: entry || {}, verified: null, status: 'error', error: 'Titre manquant' });
            continue;
        }
        
        // Rate limiting: 300ms delay between requests
        if (i > 0) {
            await new Promise(r => setTimeout(r, 300));
        }
        
        // Vérification via BnF, HAL, CrossRef, OpenLibrary
        const result = await verifyEntry(entry);
        verificationResults.push(result);
      }
      
      // 4. Analyse de risque d'hallucination
      yield { loading: true, progress: { current: total, total }, message: "Analyse des hallucinations..." };
      const hallucinationAnalysis = cslData.map((entry, i) => 
        detectHallucinationRisk(entry || {}, verificationResults[i] || null)
      );
      
      // 5. Vérification des rétractations (CrossRef API + Retraction Watch)
      yield { loading: true, progress: { current: total, total }, message: "Vérification des rétractations..." };
      const retractionChecks = [];
      for (let i = 0; i < cslData.length; i++) {
        const entry = cslData[i];
        
        // Use checkRetraction from bibcheck-enhanced.js (queries CrossRef)
        const doi = entry.DOI || entry.doi;
        const result = await checkRetraction(doi, entry.title, entry.author);
        retractionChecks.push({
            index: i,
            ...result
        });
      }
      
      // 6. Enrichir les résultats de vérification
      const enrichedResults = verificationResults.map((result, i) => {
        if (!result) return { status: 'error', original: cslData[i] }; // Safety fallback

        // Adjust hallucination risk based on verification status
        let hAnalysis = hallucinationAnalysis[i] || { level: 'unknown', riskScore: 0, reasons: [] };
        const verificationStatus = result.status;
        
        // Ensure reasons array exists
        if (!hAnalysis.reasons) hAnalysis.reasons = [];
        
        if (verificationStatus === 'not_found' || verificationStatus === 'uncertain') {
             // If not verified, increase risk
             if (hAnalysis.level === 'low') hAnalysis.level = 'medium';
             hAnalysis.riskScore = (hAnalysis.riskScore || 0) + 20;
             hAnalysis.reasons.push(`Non vérifié`);
        } else if (verificationStatus === 'verified') {
             // If verified, it's likely not a hallucination
             hAnalysis.level = 'low';
             hAnalysis.riskScore = 0;
             hAnalysis.reasons = [];
        }

        return {
            ...result,
            verification: {
              hallucinationRisk: hAnalysis.level,
              hallucinationScore: hAnalysis.riskScore,
              retracted: retractionChecks[i].retracted,
              formatIssues: formatValidation.issues.filter(issue => issue.index === i),
              isDuplicate: duplicates.some(d => d.indices.includes(i))
            }
        };
      });
      
      yield {
        loading: false,
        data: enrichedResults,
        metadata: {
          formatValidation,
          duplicates,
          hallucinationAnalysis,
          retractionChecks
        }
      };
    })()
  : { loading: false, data: [], metadata: null };
```

```js
// Display Progress Bar or Results
if (cslVerificationResults.loading) {
  const progress = cslVerificationResults.progress;
  const percentage = progress ? Math.round((progress.current / progress.total) * 100) : 0;
  
  display(html`<div class="loading-container">
    <div class="spinner"></div>
    <div style="flex: 1; margin-left: 1rem;">
      <p style="margin-bottom: 0.5rem;">${cslVerificationResults.message || 'Vérification en cours...'}</p>
      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: ${percentage}%"></div>
      </div>
      <div style="font-size: 0.8rem; text-align: right; color: var(--theme-foreground-muted);">
        ${progress ? `${progress.current}/${progress.total} (${percentage}%)` : ''}
      </div>
    </div>
  </div>`);
} else if (cslVerificationResults.error) {
  display(html`<div class="error-box">❌ ${cslVerificationResults.error}</div>`);
} else if (cslVerificationResults.data && cslVerificationResults.data.length > 0) {
  const results = cslVerificationResults.data;
  const meta = cslVerificationResults.metadata;
  
  // --- Calcul des statistiques et du score ---
  const stats = {
    verified: results.filter(r => r.status === 'verified').length,
    uncertain: results.filter(r => r.status === 'uncertain').length,
    notFound: results.filter(r => r.status === 'not_found').length,
    duplicates: meta.duplicates.length,
    retracted: meta.retractionChecks.filter(r => r.retracted).length,
    hallucinations: meta.hallucinationAnalysis.filter(h => h.level === 'high').length,
    formatErrors: meta.formatValidation.issues.filter(i => i.severity === 'error').length
  };
  
  // Calcul du score (simplifié par rapport à bibcheck-enhanced.js mais cohérent)
  let score = 100;
  const total = results.length;
  
  // Pénalités
  score -= (stats.notFound / total) * 30; // Max 30 pts pour non trouvés
  score -= (stats.uncertain / total) * 10; // Max 10 pts pour incertains
  score -= stats.retracted * 20; // -20 par rétractation
  score -= stats.hallucinations * 15; // -15 par hallucination
  score -= stats.duplicates * 5; // -5 par doublon
  score -= stats.formatErrors * 2; // -2 par erreur de format
  
  score = Math.max(0, Math.round(score));
  const scoreEmoji = score >= 80 ? '✅' : score >= 60 ? '⚠️' : '❌';
  const scoreText = score >= 80 ? 'Excellente qualité' : score >= 60 ? 'Qualité acceptable' : 'Corrections nécessaires';

  // --- Affichage des Alertes ---
  const alerts = [];
  
  if (stats.retracted > 0) {
    const retractionDetails = meta.retractionChecks.filter(r => r.retracted).map(r => {
      const sourceLabel = r.method === 'Retraction Watch Database' 
        ? '🔴 Retraction Watch' 
        : r.method === 'Publisher Notice' 
          ? '📋 Éditeur' 
          : '🔍 Analyse titre';
      return {
        title: results[r.index]?.original?.title || 'Titre inconnu',
        warnings: [
          `Source: ${sourceLabel}`,
          r.details || `Mot-clé: "${r.keyword || 'N/A'}"`
        ]
      };
    });
    
    alerts.push({
      type: 'danger',
      icon: '🚨',
      title: 'Articles rétractés détectés',
      message: `${stats.retracted} article(s) potentiellement rétracté(s)`,
      details: retractionDetails
    });
  }
  
  if (stats.hallucinations > 0) {
    alerts.push({
      type: 'warning',
      icon: '⚠️',
      title: 'Risque élevé de références hallucinées',
      message: `${stats.hallucinations} référence(s) à risque élevé`,
      details: meta.hallucinationAnalysis.filter(h => h.level === 'high').map((h, i) => ({
        title: results[i].original.title,
        warnings: h.reasons
      }))
    });
  }
  
  if (stats.duplicates > 0) {
    alerts.push({
      type: 'info',
      icon: '🔄',
      title: 'Doublons détectés',
      message: `${stats.duplicates} paire(s) de doublons potentiels`,
      details: meta.duplicates.map(d => ({
        title: `Doublon (indices ${d.indices.join(', ')})`,
        warnings: [`Type: ${d.type}`]
      }))
    });
  }
  
  if (stats.formatErrors > 0) {
    alerts.push({
      type: 'warning',
      icon: '❌',
      title: 'Erreurs de format CSL',
      message: `${stats.formatErrors} erreur(s) de format`,
      details: meta.formatValidation.issues.filter(i => i.severity === 'error').map(i => ({
        title: `Entrée ${i.index + 1}`,
        warnings: [i.message]
      }))
    });
  }

  if (alerts.length > 0) {
    display(html`<div class="alerts-container">
      ${alerts.map(alert => html`
        <div class="alert alert-${alert.type}">
          <div class="alert-header">
            <span class="alert-icon">${alert.icon}</span>
            <strong>${alert.title}</strong>
          </div>
          <p>${alert.message}</p>
          ${alert.details && alert.details.length > 0 ? html`
            <details>
              <summary>Voir les détails</summary>
              <ul>
                ${alert.details.map(d => html`<li>
                  <strong>${d.title}</strong>
                  ${d.warnings ? html`<ul>${d.warnings.map(w => html`<li>${w}</li>`)}</ul>` : ''}
                </li>`)}
              </ul>
            </details>
          ` : ''}
        </div>
      `)}
    </div>`);
  } else {
    display(html`<div class="alert alert-success">
      ✅ Aucune alerte critique détectée
    </div>`);
  }

  // --- Tableau de bord statistiques avec Score intégré ---
  display(html`<div class="stats-dashboard">
    <h3 style="display: flex; align-items: center; gap: 1rem;">
      📊 Statistiques de vérification
      <span style="margin-left: auto; font-size: 0.9rem; padding: 0.3rem 0.8rem; border-radius: 20px; background: ${score >= 80 ? 'rgba(75, 195, 182, 0.2)' : score >= 60 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${score >= 80 ? '#4BC3B6' : score >= 60 ? '#eab308' : '#ef4444'};">
        ${scoreEmoji} Score: ${score}/100 — ${scoreText}
      </span>
    </h3>
    <div class="stats-grid">
      <div class="stat-card stat-verified">
        <div class="stat-number">${stats.verified}</div>
        <div class="stat-label">Vérifiées ✅</div>
      </div>
      <div class="stat-card stat-uncertain">
        <div class="stat-number">${stats.uncertain}</div>
        <div class="stat-label">Incertaines ⚠️</div>
      </div>
      <div class="stat-card stat-notfound">
        <div class="stat-number">${stats.notFound}</div>
        <div class="stat-label">Non trouvées ❌</div>
      </div>
      <div class="stat-card" style="border-color: #9333ea; background: rgba(147, 51, 234, 0.1);">
        <div class="stat-number">${stats.retracted}</div>
        <div class="stat-label">Rétractées 🚨</div>
      </div>
    </div>
  </div>`);

  // --- Tableau détaillé ---
  const tableData = results.map((r, i) => ({
      "Index": i + 1,
      "Statut": r.status === 'verified' ? '✅' : r.status === 'uncertain' ? '⚠️' : r.status === 'retracted' ? '🚨' : '❌',
      "Titre": r.original.title,
      "Auteur": r.original.author,
      "Source": r.verified?.source || "-",
      "Confiance": r.verified ? `${r.verified.confidence}%` : "-",
      "Risque IA": meta.hallucinationAnalysis[i]?.level === 'high' ? '🚨 Élevé' : 
                   meta.hallucinationAnalysis[i]?.level === 'medium' ? '⚠️ Moyen' : '✅ Faible',
      "Rétracté": meta.retractionChecks[i]?.retracted ? '⚠️ Oui' : '✅ Non'
  }));
  
  display(Inputs.table(tableData, {
    columns: ["Index", "Statut", "Titre", "Auteur", "Source", "Confiance", "Risque IA", "Rétracté"],
    width: "100%",
    rows: 15
  }));
}
```

</div>

<div class="output-section">

```js
const useVerifiedData = view(Inputs.toggle({label: "Utiliser les données vérifiées pour la fusion (remplace les données CSL)", value: true}));
```

### 3. Fusionner
Une fois les données CSL collées et vérifiées, cliquez ci-dessous pour générer le fichier JSON fusionné.

```js
const mergedGraph = (cslInput) 
  ? mergeCSL(cslInput, graphData, selectedSourceBook, cslVerificationResults.data, useVerifiedData)
  : graphData;
```

```js
function mergeCSL(cslText, currentGraph, sourceId, verificationResults = [], useVerified = false) {
  if (!cslText || cslText.trim() === "") return currentGraph;
  
  let cslData;
  try {
    cslData = JSON.parse(cslText);
  } catch (e) {
    return { ...currentGraph, error: "Invalid JSON: " + e.message };
  }

  // Enrichir chaque entrée CSL avec les métadonnées Bibcheck
  const enrichedCSL = cslData.map((entry, i) => {
    const verification = verificationResults[i];
    if (!verification) return entry;
    
    const enrichedEntry = {
      ...entry,
      _verification: {
        verified: verification.status === 'verified',
        confidence: verification.verified?.confidence || 0,
        source: verification.verified?.source || 'none',
        hallucinationRisk: verification.verification?.hallucinationRisk || 'unknown',
        hallucinationScore: verification.verification?.hallucinationScore || 0,
        retracted: verification.verification?.retracted || false,
        isDuplicate: verification.verification?.isDuplicate || false,
        formatIssues: verification.verification?.formatIssues || []
      }
    };
    
    // Si useVerified, remplacer les données CSL par les données vérifiées
    if (useVerified && verification.verified) {
      enrichedEntry.title = verification.verified.title;
      if (verification.verified.author) {
        const authorParts = verification.verified.author.split(' ');
        enrichedEntry.author = [{
          family: authorParts[authorParts.length - 1],
          given: authorParts.slice(0, -1).join(' ')
        }];
      }
      if (verification.verified.url) {
        enrichedEntry.URL = verification.verified.url;
      }
    }
    
    return enrichedEntry;
  });

  // Deep copy to avoid mutating original
  const newGraph = JSON.parse(JSON.stringify(currentGraph));
  const nodeIds = new Set(newGraph.nodes.map(n => n.id));
  
  let newNodesCount = 0;
  let newEdgesCount = 0;

  // Helper to parse name into { first, last, isInitial }
  function parseName(name) {
    if (!name) return null;
    
    // Handle "A.Surname" (no space)
    // Regex: Starts with 1 letter, dot, then rest of name
    const noSpaceMatch = name.match(/^([A-Z])\.([A-Z][a-z\u00C0-\u00FF]+)$/);
    if (noSpaceMatch) {
      return { 
        first: noSpaceMatch[1], 
        last: noSpaceMatch[2], 
        isInitial: true 
      };
    }

    const parts = name.split(/\s+/);
    if (parts.length < 2) return null;

    const last = parts[parts.length - 1];
    const first = parts.slice(0, -1).join(' ');
    
    // Check if first name looks like an initial (1 char or ends with dot)
    const isInitial = first.length === 1 || first.endsWith('.');
    
    return { first, last, isInitial };
  }

  // Helper to find matching node (handles "A. Name" vs "Anne Name", "A.Name", and "Name, First" vs "First Name")
  function findMatchingNode(name, existingIds) {
    if (existingIds.has(name)) return name;

    const parsedName = parseName(name);
    if (!parsedName) return null;

    for (const id of existingIds) {
      const parsedId = parseName(id);
      if (!parsedId) continue;
      
      // Last name must match exactly (case-insensitive)
      if (parsedName.last.toLowerCase() !== parsedId.last.toLowerCase()) continue;

      // Check initials/first name
      const nameFirstChar = parsedName.first.charAt(0).toLowerCase();
      const idFirstChar = parsedId.first.charAt(0).toLowerCase();
      
      // If either is an initial, compare just the first letter
      if (parsedName.isInitial || parsedId.isInitial) {
        if (nameFirstChar === idFirstChar) {
          return id; // Match found!
        }
      } else {
        // Both are full names, must match exactly (or close enough?)
        // For now, assume if full names differ, they are different people
        // unless one is a substring of the other?
        // Let's stick to strict equality for full names to avoid false positives
        if (parsedName.first.toLowerCase() === parsedId.first.toLowerCase()) {
          return id;
        }
      }
    }
    
    // Additional check: handle "Nom, Prénom" vs "Prénom Nom" format
    // If name contains a comma, try to match with inverted format
    if (name.includes(',')) {
      const parts = name.split(',').map(p => p.trim());
      if (parts.length === 2) {
        const [lastName, firstName] = parts;
        const invertedName = `${firstName} ${lastName}`;
        if (existingIds.has(invertedName)) {
          return invertedName;
        }
      }
    } else {
      // If name doesn't have comma, check if any existing ID has comma with same parts
      for (const id of existingIds) {
        if (id.includes(',')) {
          const parts = id.split(',').map(p => p.trim());
          if (parts.length === 2) {
            const [lastName, firstName] = parts;
            const invertedId = `${firstName} ${lastName}`;
            if (invertedId.toLowerCase() === name.toLowerCase()) {
              return id;
            }
          }
        }
      }
    }
    
    return null;
  }

  // Helper to split combined authors like "S.Bichler J. Nitzan" or "Michał Krzykawski Anne Alombert"
  function splitCombinedAuthors(name) {
    if (!name) return [];
    
    // 1. Explicit separators common in dirty data
    if (name.includes(';') || name.includes(' & ') || name.includes(' and ')) {
        return name.split(/;| & | and /).map(n => n.trim()).filter(n => n);
    }
    
    // 2. Commas: "Bateman, Duvendack, Loubere" (3 parts)
    if (name.includes(',')) {
        const parts = name.split(',').map(n => n.trim());
        const hasSpaces = parts.every(p => p.includes(' '));
        // If > 2 parts OR (2 parts AND both have spaces -> likely "Name Name, Name Name")
        if (parts.length > 2 || (parts.length === 2 && hasSpaces)) {
             return parts;
        }
    }

    // 3. Initials Pattern (Existing)
    // Matches: "S.Bichler", "J. Nitzan", "M.-P. Virard"
    const namePattern = /[A-Z]\.(?:[- ][A-Z]\.)?\s*[A-Z][a-z\u00C0-\u00FF]+/g;
    
    const matches = name.match(namePattern);
    
    // If we found multiple matches, return them
    if (matches && matches.length > 1) {
      return matches;
    }
    
    // 4. "Name Name Name Name" (Aggressive Heuristic)
    // "Michał Krzykawski Anne Alombert" -> 4 words, capitalized, no commas
    if (!name.includes(',') && !name.includes('.')) {
        const words = name.split(/\s+/);
        // If exactly 4 words and all start with uppercase
        if (words.length === 4 && words.every(w => /^[A-Z]/.test(w))) {
             // Assume 2 names of 2 words
             const p1 = words.slice(0, 2).join(' ');
             const p2 = words.slice(2).join(' ');
             return [p1, p2];
        }
    }
    
    // Otherwise return the original name as a single-item array
    return [name];
  }

  enrichedCSL.forEach((entry, index) => {
    // Determine data source (Original vs Verified)
    let entryTitle = entry.title;
    
    // START TITLE RESCUE LOGIC (Synced with extractCSLEntries)
    let entryRawAuthors = entry.author || []; 
    
    // Heuristic for missing title recovery
    // If title is missing and we have authors, check if one might be the title
    if ((!entryTitle || entryTitle.trim() === "") && entryRawAuthors.length > 0) {
        // Check the last "author" entry (or the only one)
        const candidate = entryRawAuthors[entryRawAuthors.length - 1];
        
        // Construct full name to check for "The ...", "Le ...", etc.
        const candName = candidate.literal || (candidate.family ? (candidate.given ? `${candidate.given} ${candidate.family}` : candidate.family) : "");
        
        // Conditions to treat as title:
        const startsWithArticle = /^(The |Le |La |L'|Les |Des |Un |Une )/i.test(candName);
        const looksLikeReport = /(Review|Rapport|Report|Commission)/i.test(candName);
        const hasParticleOrSpaces = candidate.particle || (candidate.family && (candidate.family.includes(' ') || candidate.family.length > 20));

        if (hasParticleOrSpaces || startsWithArticle || looksLikeReport) {
             entryTitle = candName;
             if (candidate.particle && candidate.family) {
                  entryTitle = `${candidate.particle} ${candidate.family}`;
             }
             // Remove this candidate from authors list for this entry processing
             entryRawAuthors = entryRawAuthors.slice(0, -1);
        }
    }
    // END TITLE RESCUE LOGIC

    let entryUrl = entry.URL || "";
    let entryYear = (entry.issued && entry.issued["date-parts"] && entry.issued["date-parts"][0]) 
                    ? entry.issued["date-parts"][0][0] 
                    : null;
    let entryAuthors = [];

    // Check for verification result
    // We assume the order matches because we extract from the same input
    // Ideally we should match by title/author but index is safer if list hasn't changed
    const verifiedData = (useVerified && verificationResults && verificationResults[index]) 
                         ? verificationResults[index].verified 
                         : null;

    const authorFull = (entryRawAuthors && entryRawAuthors[0]) ? (entryRawAuthors[0].literal || (entryRawAuthors[0].family ? (entryRawAuthors[0].given ? `${entryRawAuthors[0].given} ${entryRawAuthors[0].family}` : entryRawAuthors[0].family) : "")) : null;
    const authorObj = (entryRawAuthors && entryRawAuthors[0]) ? entryRawAuthors[0] : null;
    
    // Prepare author candidates for cleaning (Original Data)
    const cleaningCandidates = [];
    if (authorObj) cleaningCandidates.push(authorObj);
    if (authorFull) cleaningCandidates.push(authorFull);

    if (verifiedData && verifiedData.found) {
      // Use verified data, but clean the title to remove " / Author" or "Author, Title" artifacts
      
      // Add verified author to candidates
      if (verifiedData.author) cleaningCandidates.push(verifiedData.author);
      
      entryTitle = cleanTitle(verifiedData.title, cleaningCandidates); 
      entryUrl = verifiedData.url || entryUrl;
      entryYear = verifiedData.year || entryYear;
      
      // Verified author handling...
      if (verifiedData.author) {
         let authStr = verifiedData.author;
         
         // 1. Split by semicolon (explicit list)
         if (authStr.includes(';')) {
             authStr.split(';').forEach(p => {
                 const clean = p.trim();
                 if (clean) entryAuthors.push(clean);
             });
         } 
         // 2. Split by comma
         else if (authStr.includes(',')) {
            const parts = authStr.split(',');
            
            // Heuristic: 
            // - If > 2 parts ("A, B, C"), assume list of authors.
            // - If 2 parts:
            //    - If both have spaces ("John Doe, Jane Smith"), assume list.
            //    - If no spaces ("Doe, John"), assume Last, First.
            
            const partsHaveSpaces = parts.every(p => p.trim().includes(' '));
            
            if (parts.length > 2 || (parts.length === 2 && partsHaveSpaces)) {
                // Treat as list of authors
                parts.forEach(p => {
                    const clean = p.trim();
                    if (clean) entryAuthors.push(clean);
                });
            } else if (parts.length === 2) {
                // Treat as "Last, First" -> "First Last"
                // Also handles "Family, Given"
                entryAuthors.push(`${parts[1].trim()} ${parts[0].trim()}`);
            } else {
                // Fallback (length 1?)
                entryAuthors.push(authStr);
            }
         } else {
            // Single author, no separator
            entryAuthors.push(authStr);
         }
      }
    } else {
      // Use original CSL data
      // APPLY CLEANING HERE TOO using Original Author candidates
      entryTitle = cleanTitle(entryTitle, cleaningCandidates);
      
      if (entryRawAuthors && entryRawAuthors.length > 0) {
        entryRawAuthors.forEach(a => {
          let name = null;
          if (a.literal) name = a.literal;
          else if (a.family) name = a.given ? `${a.given} ${a.family}` : a.family;
          
          if (name) {
            const splitNames = splitCombinedAuthors(name);
            entryAuthors.push(...splitNames);
          }
        });
      }
    }
    
    // GARBAGE FILTERING
    // 1. If title is empty -> Skip
    if (!entryTitle) return;
    
    // 2. If title looks like an author list (e.g. "Author1 Author2") AND we have no year/URL
    // Heuristic: specific regex or if title equals concatenated authors
    if (!entryYear && (!entryUrl || entryUrl.trim() === "")) {
         const quickAuthorCheck = entryAuthors.join(" ").replace(/[,.]/g, "");
         const quickTitleCheck = entryTitle.replace(/[,.]/g, "");
         
         // If title is roughly equal to authors, it's likely a parsing error (just authors)
         if (quickTitleCheck.length > 5 && quickAuthorCheck.includes(quickTitleCheck)) return;
         
         // Logic for "Name Name Name": If title is just capitalized words with no connectors
         // and matches the author pattern strongly
         if (/^([A-Z][a-z\u00C0-\u00FF]+\s?){2,}$/.test(entryTitle)) {
             // It's just a list of names?
             // If we have no year and no URL, assume it's garbage
             return;
         }
    }
    
    // Add Work Node
    if (!nodeIds.has(entryTitle)) {
      const workNode = { id: entryTitle, url: entryUrl };
      if (entryYear) {
        workNode.year = entryYear;
      }
      newGraph.nodes.push(workNode);
      nodeIds.add(entryTitle);
      newNodesCount++;
    }

    // Process each author
    entryAuthors.forEach(authorName => {
      // Resolve Author Node (check for duplicates)
      let resolvedAuthorName = authorName;
      
      const match = findMatchingNode(authorName, nodeIds);
      if (match) {
        resolvedAuthorName = match; // Use existing node
      } else if (!nodeIds.has(authorName)) {
        newGraph.nodes.push({ id: authorName, url: "" });
        nodeIds.add(authorName);
        newNodesCount++;
      }

      // Add Edge: Author -> Work
      if (resolvedAuthorName) {
        // Check if edge exists
        const edgeExists = newGraph.edges.some(e => e.source === resolvedAuthorName && e.target === entryTitle);
        if (!edgeExists) {
          newGraph.edges.push({
            source: resolvedAuthorName,
            target: entryTitle,
            type: entry.type === "webpage" ? "Site Web" : 
                  entry.type === "report" ? "Rapport" : 
                  entry.type === "article-journal" ? "Article" : "Livre"
          });
          newEdgesCount++;
        }
      }
    });

    // Add Edge: Work -> Source Book (if selected)
    if (sourceId) {
      const edgeExists = newGraph.edges.some(e => e.source === entryTitle && e.target === sourceId);
      if (!edgeExists) {
        newGraph.edges.push({
          source: entryTitle,
          target: sourceId,
          type: "Référence"
        });
        newEdgesCount++;
      }
    }
  });

  return { ...newGraph, stats: { newNodes: newNodesCount, newEdges: newEdgesCount } };
}


```


### 📊 Résultat de la fusion

```js
display(mergedGraph.error ? html`<div class="error-box">❌ ${mergedGraph.error}</div>` : html`
<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-number">${mergedGraph.stats ? mergedGraph.stats.newNodes : 0}</div>
    <div class="stat-label">Nouveaux Nœuds</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">${mergedGraph.stats ? mergedGraph.stats.newEdges : 0}</div>
    <div class="stat-label">Nouvelles Relations</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">${mergedGraph.nodes.length}</div>
    <div class="stat-label">Total Nœuds</div>
  </div>
</div>
`);
```

</div>

<div class="json-section">

## 💾 JSON Fusionné

```js
const mergedJsonOutput = JSON.stringify(mergedGraph, (key, value) => key === 'stats' ? undefined : value, 2);
```

```js
view(Inputs.textarea({
  value: mergedJsonOutput,
  rows: 15,
  width: "100%",
  readonly: true
}));
```

<div class="download-section">

```js
function downloadMergedJSON() {
  const blob = new Blob([mergedJsonOutput], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'neguentropie_Graph_merged.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

```js
view(Inputs.button("📥 Télécharger le JSON Fusionné", {
  value: null,
  reduce: () => downloadMergedJSON()
}));
```

</div>

</div>

</div>

<style>

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: var(--sans-serif);
  margin: 2rem 0 4rem;
  text-wrap: balance;
  text-align: center;
}

.hero h1 {
  margin: 1rem 0;
  padding: 1rem 0;
  max-width: none;
  font-size: clamp(2rem, 8vw, 4rem);
  font-weight: 900;
  line-height: 1.1;
  background: linear-gradient(135deg, #9333ea, #dc2626, #eab308);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero h2 {
  margin: 0;
  max-width: 40em;
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  font-style: initial;
  font-weight: 500;
  line-height: 1.5;
  color: var(--theme-foreground-muted);
}

.converter-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.input-section,
.output-section,
.json-section {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
  margin: 2rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.stat-card {
  background: linear-gradient(135deg, rgba(147, 51, 234, 0.1), rgba(220, 38, 38, 0.1));
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  border: 1px solid rgba(147, 51, 234, 0.2);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(147, 51, 234, 0.2);
}

.stat-number {
  font-size: 3rem;
  font-weight: 900;
  background: linear-gradient(135deg, #9333ea, #dc2626);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 1rem;
  color: var(--theme-foreground-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.download-section {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
}

.download-section button {
  background: linear-gradient(135deg, #9333ea, #dc2626);
  color: white;
  border: none;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(147, 51, 234, 0.3);
}

.download-section button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(147, 51, 234, 0.4);
}

.download-section button:active {
  transform: translateY(0);
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--theme-foreground-muted);
  font-style: italic;
}

code {
  background: rgba(147, 51, 234, 0.1);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
}

pre {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 1rem;
  overflow-x: auto;
  border-left: 4px solid #9333ea;
}

h2 {
  color: var(--theme-foreground);
  margin-top: 2rem;
  margin-bottom: 1rem;
  font-weight: 700;
}

h3 {
  color: var(--theme-foreground-focus);
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  font-weight: 600;
}

.url-section {
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(147, 51, 234, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(147, 51, 234, 0.15);
}

.url-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.url-header p {
  margin: 0;
  color: var(--theme-foreground);
}

.url-header button {
  background: linear-gradient(135deg, #9333ea, #dc2626);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(147, 51, 234, 0.3);
}

.url-header button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(147, 51, 234, 0.4);
}

.url-list {
  max-height: 300px;
  overflow-y: auto;
}

.url-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.url-list li {
  padding: 0.5rem;
  margin: 0.25rem 0;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  transition: background 0.2s ease;
}

.url-list li:hover {
  background: rgba(147, 51, 234, 0.1);
}

.url-list a {
  color: #9333ea;
  text-decoration: none;
  word-break: break-all;
  font-size: 0.9rem;
}

.url-list a:hover {
  text-decoration: underline;
}

.empty-state-small {
  text-align: center;
  padding: 1rem;
  color: var(--theme-foreground-muted);
  font-style: italic;
  font-size: 0.9rem;
}

/* Bibcheck Styles */
.quality-score-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 2rem auto;
  gap: 1rem;
  width: 100%;
  padding: 3rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin: 2rem 0;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-left-color: #9333ea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.progress-bar-container {
  width: 100%;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  margin: 10px 0;
  overflow: hidden;
  height: 8px;
}

.progress-bar-fill {
  height: 100%;
  background-color: #9333ea;
  transition: width 0.3s ease;
  border-radius: 4px;
}

</style>
