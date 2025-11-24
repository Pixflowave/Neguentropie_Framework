---
title: Convertisseur Bibliographie → JSON
toc: false
---

<div class="hero">
  <h1>📚 Convertisseur Bibliographie</h1>
  <h2>Transformez vos bibliographies en données structurées pour le graphique Néguentropie</h2>
</div>

<div class="converter-container">

## Format CSV attendu

Collez vos données au format CSV avec les colonnes suivantes :
- **id** : Identifiant unique (ex: "Titre du livre")
- **url** : URL de référence (optionnel)
- **source** : Nœud source pour la relation (optionnel)
- **target** : Nœud cible pour la relation (optionnel)
- **type** : Type de relation (ex: "Livre", "Individu", "Discipline", etc.)

### Exemples de formats acceptés

**Format 1 - Nœuds uniquement :**
```
id,url
"La gouvernance par les nombres","https://www.fayard.fr/livre/..."
"Essai sur le don","https://fr.wikipedia.org/wiki/Essai_sur_le_don"
```

**Format 2 - Relations uniquement :**
```
source,target,type
"Alain Supiot","La gouvernance par les nombres","Livre"
"Marcel Mauss","Essai sur le don","Livre"
```

**Format 3 - Complet (nœuds + relations) :**
```
id,url,source,target,type
"La gouvernance par les nombres","https://www.fayard.fr/livre/...","Alain Supiot","La gouvernance par les nombres","Livre"
"Essai sur le don","https://fr.wikipedia.org/wiki/...","Marcel Mauss","Essai sur le don","Livre"
```

<div class="input-section">

### 📝 Collez vos données CSV ici

```js
const csvInput = view(Inputs.textarea({
  placeholder: `Exemple:\nid,url\n"La gouvernance par les nombres","https://www.fayard.fr/livre/..."\n"Essai sur le don","https://fr.wikipedia.org/wiki/..."`,
  rows: 12,
  width: "100%",
  submit: false
}));
```

</div>

```js
import {csvParse} from "d3-dsv";

// Parse CSV and convert to JSON structure
function convertToGraphJSON(csvText) {
  if (!csvText || csvText.trim() === "") {
    return { nodes: [], edges: [] };
  }
  
  try {
    const data = csvParse(csvText);
    const nodes = [];
    const edges = [];
    const nodeIds = new Set();
    
    data.forEach(row => {
      // Add node if it has an id
      if (row.id && !nodeIds.has(row.id)) {
        const node = { id: row.id };
        if (row.url) node.url = row.url;
        nodes.push(node);
        nodeIds.add(row.id);
      }
      
      // Add edge if it has source and target
      if (row.source && row.target) {
        const edge = {
          source: row.source,
          target: row.target,
          type: row.type || "relation"
        };
        edges.push(edge);
        
        // Add source and target as nodes if they don't exist
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
}

const graphData = convertToGraphJSON(csvInput);
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
