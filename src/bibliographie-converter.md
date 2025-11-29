---
title: Convertisseur Bibliographie → JSON
toc: false
---

<div class="hero">
  <h1>📚 Convertisseur Bibliographie CSL-JSON</h1>
  <h2>Importez vos bibliographies au format CSL-JSON et fusionnez-les avec le graphique Néguentropie</h2>
</div>

<div class="converter-container">

## 🔄 Fusion CSL-JSON (AnyStyle.io)

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

Vérifiez les références avec HAL, BnF, OpenLibrary et CrossRef avant de fusionner.

```js
import {verifyBibliography, calculateSimilarity} from "./components/bibliography-verifier.js";
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
      let author = "";
      if (entry.author && entry.author.length > 0) {
        const a = entry.author[0];
        if (a.literal) author = a.literal;
        else if (a.family) author = a.given ? `${a.given} ${a.family}` : a.family;
      }
      
      let year = "";
      if (entry.issued && entry.issued["date-parts"] && entry.issued["date-parts"][0]) {
        year = entry.issued["date-parts"][0][0];
      }

      return {
        title: entry.title,
        author: author,
        year: year,
        originalUrl: entry.URL
      };
    }).filter(e => e.title);
  } catch (e) {
    return [];
  }
}

const cslVerificationResults = cslVerificationTriggered && cslInput
  ? (async function*() {
      yield { loading: true };
      const entries = extractCSLEntries(cslInput);
      const results = await verifyBibliography(entries);
      yield { loading: false, data: results };
    })()
  : { loading: false, data: [] };
```

```js
// Display CSL verification results
if (cslVerificationResults.loading) {
  display(html`<div class="loading-container">
    <div class="spinner"></div>
    <p>Vérification en cours avec HAL, BnF, OpenLibrary et CrossRef...</p>
  </div>`);
} else if (cslVerificationResults.data && cslVerificationResults.data.length > 0) {
  const results = cslVerificationResults.data;
  
  const tableData = results.map(r => ({
      "Statut": r.status === 'verified' ? '✅' : r.status === 'uncertain' ? '⚠️' : '❌',
      "Confiance": r.verified ? `${r.verified.confidence}%` : "-",
      "Titre original": r.original.title,
      "Auteur original": r.original.author,
      "Titre trouvé": r.verified?.title || "Non trouvé",
      "Source": r.verified?.source || "-"
  }));
  
  display(Inputs.table(tableData, {
    columns: ["Statut", "Confiance", "Titre original", "Auteur original", "Titre trouvé", "Source"],
    width: "100%",
    rows: 10
  }));

  const stats = {
    verified: results.filter(r => r.status === 'verified').length,
    uncertain: results.filter(r => r.status === 'uncertain').length,
    notFound: results.filter(r => r.status === 'not_found').length,
    bnf: results.filter(r => r.verified?.source === 'BnF').length
  };

  display(html`<div class="verification-stats">
    <div class="stats-row">
      <span>✅ Vérifiées : <strong>${stats.verified}</strong></span>
      <span>🏛️ BnF : <strong>${stats.bnf}</strong></span>
    </div>
  </div>`);
}
```

</div>

<div class="output-section">

```js
const useVerifiedData = view(Inputs.toggle({label: "Utiliser les données vérifiées pour la fusion (remplace les données CSL)", value: true}));
```

### 3. Fusionner
Une fois le JSON collé (et vérifié), cliquez ci-dessous pour générer le graphe fusionné.

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

  // Helper to split combined authors like "S.Bichler J. Nitzan"
  function splitCombinedAuthors(name) {
    // Regex to find "Initial. Surname" or "Initial.Surname" or "I.-I. Surname"
    // Matches: "S.Bichler", "J. Nitzan", "M.-P. Virard"
    const namePattern = /[A-Z]\.(?:[- ][A-Z]\.)?\s*[A-Z][a-z\u00C0-\u00FF]+/g;
    
    const matches = name.match(namePattern);
    
    // If we found multiple matches, return them
    if (matches && matches.length > 1) {
      return matches;
    }
    
    // Otherwise return the original name as a single-item array
    return [name];
  }

  cslData.forEach((entry, index) => {
    // Determine data source (Original vs Verified)
    let entryTitle = entry.title;
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

    if (verifiedData && verifiedData.found) {
      // Use verified data
      entryTitle = verifiedData.title;
      entryUrl = verifiedData.url || entryUrl; // Keep original URL if verified has none? Or prefer verified?
      entryYear = verifiedData.year || entryYear;
      
      // Verified author is usually a single string "First Last" or "Last, First"
      // We need to handle it.
      if (verifiedData.author) {
         // If comma present, assume "Last, First" -> convert to "First Last"
         if (verifiedData.author.includes(',')) {
            const parts = verifiedData.author.split(',');
            if (parts.length === 2) {
                entryAuthors.push(`${parts[1].trim()} ${parts[0].trim()}`);
            } else {
                entryAuthors.push(verifiedData.author);
            }
         } else {
            entryAuthors.push(verifiedData.author);
         }
      }
    } else {
      // Use original CSL data
      if (entry.author && entry.author.length > 0) {
        entry.author.forEach(a => {
          let name = null;
          if (a.literal) name = a.literal;
          else if (a.family) name = a.given ? `${a.given} ${a.family}` : a.family;
          
          if (name) {
            // Try to split combined strings
            const splitNames = splitCombinedAuthors(name);
            entryAuthors.push(...splitNames);
          }
        });
      }
    }
    
    if (!entryTitle) return; // Skip if no title

    // Add Work Node
    // Check if title already exists (using exact match for now)
    // TODO: Could use smart matching for titles too?
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

.verification-stats {
  background: linear-gradient(135deg, rgba(147, 51, 234, 0.1), rgba(220, 38, 38, 0.05));
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1.5rem 0;
  border: 1px solid rgba(147, 51, 234, 0.2);
}

.verification-stats h4 {
  margin: 0 0 1rem 0;
  color: var(--theme-foreground);
  font-size: 1.1rem;
}

.stats-row {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  font-size: 0.95rem;
}

.stats-row span {
  color: var(--theme-foreground-muted);
}

.stats-row strong {
  color: var(--theme-foreground);
  font-size: 1.1em;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-top: 1rem;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-left-color: #dcb0ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .hero h1 {
    font-size: 2rem;
  }
  .output-section,
  .json-section {
    padding: 1.5rem;
  }
  
  .stat-number {
    font-size: 2rem;
  }
}

</style>
