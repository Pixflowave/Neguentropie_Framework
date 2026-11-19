// Précalcule la carte Airocean découpée en triangles du graphique « Airocean ·
// attracteur de Lorenz » (port du notebook @pixflowave/airocean-attracteur-de-lorenz,
// qui reprend @fil/triangular-tiling-of-icosahedron et le « speedy polybool » de
// Philippe Rivière). Le navigateur n'a plus qu'à dessiner les chemins SVG.
//
// Usage : npm run airocean  →  src/data/airocean-triangles.json
// À relancer seulement si l'on change la projection, la subdivision ou la carte.
import {readFileSync, writeFileSync} from "node:fs";
import {Delaunay, geoCentroid, geoInterpolate, geoPath, geoProjection, polygonArea} from "d3";
import {geoAirocean, geoGrayFullerRaw, geoIcosahedral} from "d3-geo-polygon";
import {geoProject} from "d3-geo-projection";
import PolyBool from "polybooljs";

const LARGEUR = 1000; // repère de calcul ; le SVG est ensuite mis à l'échelle
const HAUTEUR = LARGEUR * 0.5;
const SUBDIVISIONS = 5; // n du notebook de Philippe Rivière : 25 triangles par face

// Projection Airocean, orientation de Fuller, transformation de Gray
const projection = geoIcosahedral()
  .faceProjection((face) => {
    const c = face.site.map((d) => -d);
    c[2] = Math.abs(c[1] - 52.62) < 1 || Math.abs(c[1] + 10.81) < 1 ? 60 : 0;
    return geoProjection(geoGrayFullerRaw()).rotate(c).translate([0, 0]);
  })
  .rotate(geoAirocean().rotate())
  .fitExtent([[1, 1], [LARGEUR - 1, HAUTEUR - 1]], {type: "Sphere"});

// Faces du patron (structure), puis triangles de découpe (cutter)
function faces() {
  const rotation = projection.rotate();
  projection.rotate([0, 0, 0]);
  const liste = [];
  (function parcourir(face) {
    liste.push(face);
    for (const enfant of face.children ?? []) parcourir(enfant);
  })(projection.tree());
  projection.rotate(rotation);
  return liste;
}

function triangles() {
  const rotation = projection.rotate();
  projection.rotate([0, 0]);
  const n = SUBDIVISIONS;
  const resultat = [];
  for (const face of faces()) {
    const coins = face.face.map((e) => projection(geoInterpolate(e, face.centroid ?? geoCentroid({type: "MultiPoint", coordinates: face.face}))(1e-5)));
    const points = [];
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= i; j++) {
        const c = [n - i, i - j, j].map((d) => d / n);
        points.push([
          c[0] * coins[0][0] + c[1] * coins[1][0] + c[2] * coins[2][0],
          c[0] * coins[0][1] + c[1] * coins[1][1] + c[2] * coins[2][1]
        ]);
      }
    }
    resultat.push(...Array.from(Delaunay.from(points).trianglePolygons()).filter((d) => polygonArea(d) > 10));
  }
  projection.rotate(rotation);
  return resultat;
}

// GeoJSON plan → polygone PolyBool (trous ignorés, comme dans le notebook)
function versPolyBool(geojson) {
  const multi = [];
  (function ajouter(t) {
    if (t.type === "Polygon") multi.push(t.coordinates);
    else if (t.type === "MultiPolygon") multi.push(...t.coordinates);
    else if (t.type === "GeometryCollection") t.geometries.forEach(ajouter);
    else if (t.type === "Feature") ajouter(t.geometry);
    else if (t.type === "FeatureCollection") t.features.forEach(ajouter);
  })(geojson);
  const anneau = (ls) => [ls[ls.length - 1], ...ls.slice(0, -1)];
  return {inverted: false, regions: multi.map((p) => p[0]).filter((d) => d.length).map(anneau)};
}

const terres = JSON.parse(readFileSync("node_modules/visionscarto-world-atlas/world/110m_land.geojson", "utf8"));
const segmentsTerres = PolyBool.segments(versPolyBool(geoProject(terres, projection)));
const chemin = geoPath().digits(1);

const sortie = triangles().map((tri) => {
  const segmentsTri = PolyBool.segments({inverted: false, regions: [tri.slice(0, -1)]});
  const morceau = PolyBool.polygonToGeoJSON(PolyBool.polygon(PolyBool.selectIntersect(PolyBool.combine(segmentsTri, segmentsTerres))));
  return {t: chemin({type: "Polygon", coordinates: [tri]}), l: chemin(morceau) || ""};
});

writeFileSync("src/data/airocean-triangles.json", JSON.stringify({
  source: "Natural Earth 110m (visionscarto-world-atlas 0.0.6), projection Airocean (d3-geo-polygon)",
  largeur: LARGEUR,
  hauteur: HAUTEUR,
  triangles: sortie
}));
console.log(`${sortie.length} triangles, dont ${sortie.filter((d) => d.l).length} avec des terres.`);
