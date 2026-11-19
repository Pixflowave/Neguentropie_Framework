---
sidebar: false
header: false
footer: false
toc: false
pager: false
---

```js
import {cadre} from "../components/cadre.js";
import {graphe} from "../graphiques/graphe.js";
display(cadre(await graphe(), {
  titre: "Graphe réticulé des bifurcations noétiques",
  notebook: "@pixflowave/graph_neguentropie",
  hauteur: 600
}))
```