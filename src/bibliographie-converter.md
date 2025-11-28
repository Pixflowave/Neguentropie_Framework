---
title: Convertisseur Bibliographie → JSON
toc: false
---

<div class="hero">
  <h1>📚 Convertisseur Bibliographie</h1>
  <h2>Transformez vos bibliographies en données structurées pour le graphique Néguentropie</h2>
</div>

<div class="converter-container">

## Format de Bibliographie

Collez votre bibliographie directement ! Le convertisseur accepte deux formats :

### Format 1 : Bibliographie Académique (Recommandé)

Collez simplement votre liste de références bibliographiques au format standard :

```
Auteur, Titre, Éditeur, Année.
A. Alombert, Schizophrénie numérique, Paris, Allia, 2023.
CNNum, Rapport sur l'IA générative, Paris, 2024.
```

Le parser détectera automatiquement :
- **Auteur(s)** : Créé comme nœud "Individu"
- **Titre** : Créé comme nœud "Livre", "Rapport", "Article", etc. selon le contexte.
- **Relation** : Auteur → Œuvre (typée selon la nature de l'œuvre)

### Format 2 : CSV Structuré

Pour plus de contrôle, utilisez le format CSV :

```csv
id,url,source,target,type
"La gouvernance par les nombres","https://...","Alain Supiot","La gouvernance par les nombres","Livre"
"Rapport IA","https://...","CNNum","Rapport IA","Rapport"
```

<div class="input-section">

### 📖 Titre du livre source (optionnel)

Si cette bibliographie provient d'un livre spécifique, indiquez son titre. Tous les auteurs seront liés à ce livre.

```js
const sourceBookTitle = view(Inputs.text({
  placeholder: "Ex: Néguentropie et capitalisme computationnel",
  width: "100%"
}));
```

### 📝 Collez votre bibliographie ici

```js
const bibInput = view(Inputs.textarea({
  placeholder: `Exemple:\nA. Alombert, Schizophrénie numérique, Paris, Allia, 2023.\nB. Stiegler, La Société automatique, Paris, Fayard, 2015.\n\nOu format CSV:\nid,url\n"Titre","https://..."`,
  rows: 15,
  width: "100%",
  submit: false
}));
```



### 🔍 Vérification bibliographique (optionnel)

```js
import {verifyBibliography, calculateSimilarity} from "./components/bibliography-verifier.js";
```

```js
const verifyButton = view(Inputs.button("🔍 Vérifier avec HAL + OpenLibrary + CrossRef", {
  value: null,
  reduce: () => "verify"
}));
```

```js
// State for verification results
const verificationTriggered = verifyButton === "verify";
```

```js
// Extract entries for verification
function extractEntriesForVerification(text) {
  if (!text || text.trim() === "") return [];
  
  const lines = text.split('\n');
  const entries = [];
  
  lines.forEach(line => {
    const entry = parseBibliographyEntry(line);
    if (entry && entry.author && entry.title) {
      entries.push({
        author: entry.author,
        title: entry.title,
        year: entry.year,
        originalUrl: entry.url
      });
    }
  });
  
  return entries;
}
```

```js
// Perform verification when button is clicked
const verificationResults = verificationTriggered && bibInput 
  ? (async function*() {
      yield { loading: true };
      const results = await verifyBibliography(extractEntriesForVerification(bibInput));
      yield { loading: false, data: results };
    })()
  : { loading: false, data: [] };
```

```js
// Display verification results
// Prepare data for table
const verificationTableData = (verificationResults.data && verificationResults.data.length > 0)
  ? verificationResults.data.map(r => ({
      ...r, // Keep original data
      "Titre original": r.original.title,
      "Auteur original": r.original.author,
      "Titre trouvé": r.verified?.title || "Non trouvé",
      "ID": r.verified?.halId || r.verified?.isbn || r.verified?.doi || "-",
      "Source": r.verified?.source || "-",
      "Confiance": r.verified ? `${r.verified.confidence}%` : "-",
      "Statut": r.status === 'verified' ? '✅' : r.status === 'uncertain' ? '⚠️' : '❌'
    }))
  : [];
```

```js
// Display verification results table
if (verificationResults.data && verificationResults.data.length > 0) {
  const results = verificationResults.data;
  
  display(Inputs.table(verificationTableData, {
    columns: [
      "Statut",
      "Confiance",
      "Titre original",
      "Auteur original",
      "Titre trouvé",
      "ID",
      "Source"
    ],
    header: {
      "Statut": "",
      "Titre original": "Titre (Biblio)",
      "Auteur original": "Auteur",
      "Titre trouvé": "Suggestion API"
    },
    width: "100%",
    rows: 15
  }));
}
```

```js
// Display verification UI
if (verificationResults.loading) {
  display(html`<div class="loading-container">
    <div class="spinner"></div>
    <p>Vérification en cours avec HAL, OpenLibrary et CrossRef...</p>
    <small>Cela peut prendre quelques secondes pour respecter les limites des APIs.</small>
  </div>`);
} else if (verificationResults.data && verificationResults.data.length > 0) {
  const results = verificationResults.data;
  const stats = {
    total: results.length,
    verified: results.filter(r => r.status === 'verified').length,
    uncertain: results.filter(r => r.status === 'uncertain').length,
    notFound: results.filter(r => r.status === 'not_found').length,
    fromHAL: results.filter(r => r.verified?.source === 'HAL').length,
    fromOpenLibrary: results.filter(r => r.verified?.source === 'OpenLibrary').length,
    fromCrossRef: results.filter(r => r.verified?.source === 'CrossRef').length
  };
  
  display(html`<div class="verification-stats">
    <h4>📊 Résultats de la vérification</h4>
    <div class="stats-row">
      <span>✅ Vérifiées : <strong>${stats.verified}</strong></span>
      <span>⚠️ Incertaines : <strong>${stats.uncertain}</strong></span>
      <span>❌ Non trouvées : <strong>${stats.notFound}</strong></span>
    </div>
    <div class="stats-row" style="margin-top: 0.5rem; font-size: 0.85rem;">
      <span>🇫🇷 HAL : ${stats.fromHAL}</span>
      <span>📚 OpenLibrary : ${stats.fromOpenLibrary}</span>
      <span>📄 CrossRef : ${stats.fromCrossRef}</span>
    </div>
  </div>`);
  
}

```

</div>

```js
import {csvParse} from "d3-dsv";

// Parse bibliography entry (Author, Title, Publisher, Year format)
function parseBibliographyEntry(line) {
  // Skip empty lines and lines that are just dashes or special characters
  if (!line || line.trim() === '' || /^[-—–\s*]+$/.test(line.trim())) {
    return null;
  }
  
  // Extract URL if present (before removing it from the line)
  const urlRegex = /(https?:\/\/[^\s,)"']+)/;
  const urlMatch = line.match(urlRegex);
  const url = urlMatch ? urlMatch[1] : "";
  
  // Remove URL from line for parsing
  let cleanLine = line.replace(urlRegex, '').trim();
  
  // Remove leading dashes and clean up
  cleanLine = cleanLine.replace(/^[-—–]\s*/, '').trim();
  
  // Extract year (handle (1994) or 1994 at end)
  let year = null;
  const yearMatchParens = cleanLine.match(/\((\d{4})\)/);
  const yearMatchEnd = cleanLine.match(/,?\s*(\d{4})[.,\s]*$/);
  
  if (yearMatchParens) {
    year = yearMatchParens[1];
    // Remove year from line to avoid confusion
    cleanLine = cleanLine.replace(/\s*\(\d{4}\)/, '');
  } else if (yearMatchEnd) {
    year = yearMatchEnd[1];
    cleanLine = cleanLine.substring(0, cleanLine.lastIndexOf(year)).trim();
  }
  
  // Remove trailing punctuation
  cleanLine = cleanLine.replace(/[.,;]+$/, '');
  
  // Split by comma to get parts
  const parts = cleanLine.split(',').map(p => p.trim());
  
  if (parts.length < 2) {
    return null; // Not enough information
  }
  
  // --- Author Parsing ---
  let author = parts[0];
  
  // Clean author string
  author = author.replace(/\s*\(dir\.\)|\s*\(ed\.\)|\s*\(eds\.\)/i, ''); // Remove roles
  author = author.replace(/\s+et al\.?$/i, ''); // Remove et al
  
  // Handle multiple authors (keep as one string for the node, but clean it)
  // "Author1 & Author2" or "Author1 and Author2"
  
  // Handle special cases like "—" or "-" which means "same author as above"
  if (author === '—' || author === '-' || author === '→') {
    return null; // We'll handle this by keeping track of last author in the main loop
  }
  
  // --- Title Parsing ---
  // Find where the title ends - look for common patterns
  // Common publisher cities in French bibliography
  const publisherCities = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 
                           'Londres', 'London', 'New York', 'Cambridge', 'Oxford', 
                           'Chicago', 'Boston', 'Princeton', 'Berlin', 'Limoges',
                           'Bry-sur-Marne', 'Genève', 'Geneva', 'Bruxelles', 'Brussels',
                           'Lausanne', 'Montréal', 'Ottawa', 'Québec', 'Amsterdam',
                           'Rome', 'Madrid', 'Barcelone', 'Milan', 'Turin', 'Vienne',
                           'Francfort', 'Munich', 'Hambourg', 'Copenhague', 'Stockholm'];
  
  let titleEndIndex = parts.length - 1; // Default: everything except author
  
  // Look for where publisher info starts (usually a city name)
  // Start from index 1 (second part, after author)
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    
    // Check if this part is a publisher city
    const isCity = publisherCities.some(city => 
      part === city || part.startsWith(city + ' ')
    );
    
    if (isCity) {
      titleEndIndex = i - 1;
      break;
    }
  }
  
  // If we still have too many parts and didn't find a city, 
  // assume last 1-2 parts are publisher info
  if (titleEndIndex === parts.length - 1 && parts.length > 3) {
    titleEndIndex = parts.length - 2;
  }
  
  // Ensure we have at least the second part as title
  if (titleEndIndex < 1) {
    titleEndIndex = 1;
  }
  
  // Combine parts to form the title
  let title = parts.slice(1, titleEndIndex + 1).join(', ');
  
  // Clean title: handle quotes and subtitles
  title = title.replace(/[«»""]/g, '"').replace(/^["']|["']$/g, '').trim();
  
  // --- Type Detection ---
  let type = "Livre"; // Default
  
  const lowerTitle = title.toLowerCase();
  const lowerLine = line.toLowerCase();
  
  if (url && (lowerTitle.includes('www') || lowerTitle.includes('http') || lowerLine.includes('consult') || lowerLine.includes('accessed'))) {
    type = "Site Web";
  } else if (lowerTitle.includes('rapport') || lowerTitle.includes('report') || lowerTitle.includes('white paper')) {
    type = "Rapport";
  } else if (lowerLine.includes('in:') || lowerLine.includes('dans:')) {
    type = "Chapitre";
  } else if (parts.length > 3 && (lowerLine.includes('vol.') || lowerLine.includes('no.') || lowerLine.includes('pp.'))) {
    // Heuristic for articles: usually have Volume, Issue, Pages
    type = "Article";
  }
  
  return {
    author: author.trim(),
    title: title,
    year: year,
    url: url,
    type: type,
    raw: line
  };
}

// Convert bibliography text to graph JSON
function convertToGraphJSON(inputText, sourceBook) {
  if (!inputText || inputText.trim() === "") {
    return { nodes: [], edges: [] };
  }
  
  const text = inputText.trim();
  
  // Check if it's CSV format (has header row with commas)
  const firstLine = text.split('\n')[0];
  const isCSV = firstLine.includes(',') && (
    firstLine.toLowerCase().includes('id') || 
    firstLine.toLowerCase().includes('source') ||
    firstLine.toLowerCase().includes('target')
  );
  
  if (isCSV) {
    // Use CSV parser
    try {
      const data = csvParse(text);
      const nodes = [];
      const edges = [];
      const nodeIds = new Set();
      
      data.forEach(row => {
        if (row.id && !nodeIds.has(row.id)) {
          const node = { id: row.id };
          if (row.url) node.url = row.url;
          nodes.push(node);
          nodeIds.add(row.id);
        }
        
        if (row.source && row.target) {
          const edge = {
            source: row.source,
            target: row.target,
            type: row.type || "relation"
          };
          edges.push(edge);
          
          if (!nodeIds.has(row.source)) {
            nodes.push({ id: row.source });
            nodeIds.add(row.source);
          }
          if (!nodeIds.has(row.target)) {
            nodes.push({ id: row.target });
            nodeIds.add(row.target);
          }
        }
      });
      
      return { nodes, edges };
    } catch (error) {
      return { error: error.message, nodes: [], edges: [] };
    }
  } else {
    // Convert bibliography to graph JSON format
    const nodes = [];
    const edges = [];
    const nodeIds = new Set();
    let lastAuthor = null;
    
    // Add source book node if provided
    if (sourceBook && sourceBook.trim()) {
      const sourceTitle = sourceBook.trim();
      nodes.push({
        id: sourceTitle,
        url: "",
        type: "source"
      });
      nodeIds.add(sourceTitle);
    }
    
    if (text) {
      const lines = text.split('\n');
      
      lines.forEach(line => {
        const entry = parseBibliographyEntry(line);
        
        // Check if this is a continuation line (starts with dash/arrow)
        const isContinuation = line.trim().match(/^[-—–→]\s+/);
        
        if (!entry && !isContinuation) return;
        
        let author, title, year, url, type;
        
        if (isContinuation && lastAuthor) {
          // This is a continuation of the previous author
          author = lastAuthor;
          // Parse the line after removing the leading dash
          const cleanedLine = line.replace(/^[-—–→]\s*,?\s*/, '').trim();
          const tempEntry = parseBibliographyEntry(cleanedLine);
          if (!tempEntry) return;
          title = tempEntry.title;
          year = tempEntry.year;
          url = tempEntry.url;
          type = tempEntry.type;
        } else if (entry) {
          author = entry.author;
          title = entry.title;
          year = entry.year;
          url = entry.url;
          type = entry.type;
          lastAuthor = author;
        } else {
          return;
        }
        
        if (!author || !title) return;
        
        // Add author node
        if (!nodeIds.has(author)) {
          nodes.push({ 
            id: author,
            url: "" 
          });
          nodeIds.add(author);
        }
        
        // Add book/article node
        if (!nodeIds.has(title)) {
          const bookNode = { 
            id: title,
            url: url || ""
          };
          if (year) {
            bookNode.year = year;
          }
          nodes.push(bookNode);
          nodeIds.add(title);
        }
        
        // Add edge from author to book
        edges.push({
          source: author,
          target: title,
          type: type || "Livre"
        });
        
        // If source book is provided, add edge from book to source book
        if (sourceBook && sourceBook.trim()) {
          edges.push({
            source: title,
            target: sourceBook.trim(),
            type: "Référence"
          });
        }
      });
    }
    
    return { nodes, edges };
  }
}

const graphData = convertToGraphJSON(bibInput, sourceBookTitle);

// Create a blob for download
const jsonBlob = new Blob([JSON.stringify(graphData, null, 2)], {type: "application/json"});
const jsonUrl = URL.createObjectURL(jsonBlob);

// Function to save directly to disk using File System Access API
async function saveToDisk() {
  try {
    const options = {
      suggestedName: 'bibliography_graph.json',
      types: [{
        description: 'JSON Files',
        accept: {'application/json': ['.json']},
      }],
    };
    
    const handle = await window.showSaveFilePicker(options);
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(graphData, null, 2));
    await writable.close();
    
    alert("Fichier sauvegardé avec succès !");
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(err);
      alert("Erreur lors de la sauvegarde : " + err.message);
    }
  }
}

// Check if File System Access API is supported
const isFileSystemSupported = typeof window !== 'undefined' && 'showSaveFilePicker' in window;
```

<div class="output-section">

## 📊 Aperçu des données

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-number">${graphData.nodes.length}</div>
    <div class="stat-label">Nœuds</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">${graphData.edges.length}</div>
    <div class="stat-label">Relations</div>
  </div>
</div>

### 🔗 Nœuds (${graphData.nodes.length})

${graphData.nodes.length > 0 ? Inputs.table(graphData.nodes, {
  columns: ["id", "url"],
  width: "100%"
}) : html`<p class="empty-state">Aucun nœud détecté. Collez vos données CSV ci-dessus.</p>`}

### 🔀 Relations (${graphData.edges.length})

${graphData.edges.length > 0 ? Inputs.table(graphData.edges, {
  columns: ["source", "target", "type"],
  width: "100%"
}) : html`<p class="empty-state">Aucune relation détectée.</p>`}

</div>

<div class="json-section">

## 💾 JSON Généré

```js
const jsonOutput = JSON.stringify(graphData, null, 2);
```

```js
view(Inputs.textarea({
  value: jsonOutput,
  rows: 15,
  width: "100%",
  readonly: true
}));
```

<div class="download-section">

```js
function downloadJSON() {
  const blob = new Blob([jsonOutput], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'neguentropie_graph.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

```js
view(Inputs.button("📥 Télécharger le JSON", {
  value: null,
  reduce: () => downloadJSON()
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
