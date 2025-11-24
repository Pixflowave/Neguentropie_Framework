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
B. Stiegler, La Société automatique, Paris, Fayard, 2015.
```

Le parser détectera automatiquement :
- **Auteur(s)** : Créé comme nœud "Individu"
- **Titre** : Créé comme nœud "Livre"
- **Relation** : Auteur → Livre

### Format 2 : CSV Structuré

Pour plus de contrôle, utilisez le format CSV :

```csv
id,url,source,target,type
"La gouvernance par les nombres","https://www.fayard.fr/livre/...","Alain Supiot","La gouvernance par les nombres","Livre"
```

<div class="input-section">

### 📝 Collez votre bibliographie ici

```js
const bibInput = view(Inputs.textarea({
  placeholder: `Exemple:\nA. Alombert, Schizophrénie numérique, Paris, Allia, 2023.\nB. Stiegler, La Société automatique, Paris, Fayard, 2015.\n\nOu format CSV:\nid,url\n"Titre","https://..."`,
  rows: 15,
  width: "100%",
  submit: false
}));
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
  
  // Remove leading dashes and clean up
  line = line.replace(/^[-—–]\s*/, '').trim();
  
  // Extract year (usually at the end, 4 digits)
  const yearMatch = line.match(/,?\s*(\d{4})[.,\s]*$/);
  const year = yearMatch ? yearMatch[1] : null;
  let withoutYear = year ? line.substring(0, line.lastIndexOf(year)).trim() : line;
  
  // Remove trailing punctuation
  withoutYear = withoutYear.replace(/[.,;]+$/, '');
  
  // Split by comma to get parts
  const parts = withoutYear.split(',').map(p => p.trim());
  
  if (parts.length < 2) {
    return null; // Not enough information
  }
  
  // First part is usually the author
  let author = parts[0];
  
  // Handle special cases like "—" or "-" which means "same author as above"
  if (author === '—' || author === '-' || author === '→') {
    return null; // We'll handle this by keeping track of last author
  }
  
  // Find where the title ends - look for common patterns
  // Common publisher cities in French bibliography
  const publisherCities = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 
                           'Londres', 'London', 'New York', 'Cambridge', 'Oxford', 
                           'Chicago', 'Boston', 'Princeton', 'Berlin', 'Limoges',
                           'Bry-sur-Marne'];
  
  let titleEndIndex = 1; // Start with second part (after author)
  
  // Look for where publisher info starts (usually a city name)
  for (let i = 2; i < parts.length; i++) {
    const part = parts[i].trim();
    // Check if this part looks like a publisher city or location
    const isCity = publisherCities.some(city => part.startsWith(city));
    // Check if it looks like a publisher (often starts with capital letter and is short)
    const isPublisher = /^[A-Z]/.test(part) && part.length < 40 && !part.includes('.');
    
    if (isCity) {
      titleEndIndex = i - 1;
      break;
    }
  }
  
  // If we didn't find a city, assume title is everything except last 1-2 parts (publisher/location)
  if (titleEndIndex === 1 && parts.length > 3) {
    titleEndIndex = parts.length - 2;
  }
  
  // Combine parts to form the title
  let title = parts.slice(1, titleEndIndex + 1).join(', ').replace(/[«»""]/g, '"').replace(/^["']|["']$/g, '').trim();
  
  return {
    author: author,
    title: title,
    year: year,
    raw: line
  };
}

// Convert bibliography text to graph JSON
function convertToGraphJSON(inputText) {
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
    // Parse as bibliography format
    const lines = text.split('\n');
    const nodes = [];
    const edges = [];
    const nodeIds = new Set();
    let lastAuthor = null;
    
    lines.forEach(line => {
      const entry = parseBibliographyEntry(line);
      
      // Check if this is a continuation line (starts with dash/arrow)
      const isContinuation = line.trim().match(/^[-—–→]\s+/);
      
      if (!entry && !isContinuation) return;
      
      let author, title, year;
      
      if (isContinuation && lastAuthor) {
        // This is a continuation of the previous author
        author = lastAuthor;
        // Parse the line after removing the leading dash
        const cleanedLine = line.replace(/^[-—–→]\s*,?\s*/, '').trim();
        const tempEntry = parseBibliographyEntry(cleanedLine);
        if (!tempEntry) return;
        title = tempEntry.title;
        year = tempEntry.year;
      } else if (entry) {
        author = entry.author;
        title = entry.title;
        year = entry.year;
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
          url: ""
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
        type: "Livre"
      });
    });
    
    return { nodes, edges };
  }
}

const graphData = convertToGraphJSON(bibInput);
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

@media (max-width: 768px) {
  .input-section,
  .output-section,
  .json-section {
    padding: 1.5rem;
  }
  
  .stat-number {
    font-size: 2rem;
  }
}

</style>
