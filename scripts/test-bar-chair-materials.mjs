/**
 * Headless Babylon probe: Bar-Chair multi-material after load + instantiate.
 * Usage: node scripts/test-bar-chair-materials.mjs [path-to.glb]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  NullEngine,
  Scene,
  MultiMaterial,
  PBRMaterial,
} from "@babylonjs/core";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const glbPath =
  process.argv[2] ??
  path.resolve(__dirname, "../public/custom-models/Bar_chair_V3.glb");

function matInfo(mat) {
  if (!mat) return null;
  const out = { class: mat.getClassName(), name: mat.name };
  if (mat instanceof PBRMaterial) {
    out.metallic = mat.metallic;
    out.roughness = mat.roughness;
    out.hasAlbedo = Boolean(mat.albedoTexture);
    out.hasMr = Boolean(mat.metallicTexture);
  }
  if (mat instanceof MultiMaterial) {
    out.subCount = mat.subMaterials.length;
    out.subs = mat.subMaterials.map((s) => matInfo(s));
  }
  return out;
}

function meshInfo(mesh) {
  const subs = (mesh.subMeshes ?? []).map((sm, i) => ({
    i,
    matIndex: sm.materialIndex,
    mat: matInfo(sm.getMaterial()),
  }));
  return {
    name: mesh.name,
    material: matInfo(mesh.material),
    subMeshes: subs,
  };
}

async function main() {
  const buf = fs.readFileSync(glbPath);
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const container = await LoadAssetContainerAsync(new Uint8Array(buf), scene, {
    pluginExtension: ".glb",
    name: path.basename(glbPath),
  });

  console.log("=== CONTAINER ===");
  console.log("materials:", container.materials.length);
  for (const m of container.materials) {
    console.log(" ", matInfo(m));
  }
  console.log("meshes:", container.meshes.length);
  for (const m of container.meshes) {
    console.log(" ", meshInfo(m));
  }

  const instance = container.instantiateModelsToScene((n) => `inst-${n}`, true);
  console.log("\n=== AFTER instantiateModelsToScene ===");
  const roots = instance.rootNodes;
  const meshes = [];
  const walk = (node) => {
    if (node.getChildMeshes) meshes.push(...node.getChildMeshes(true));
    if (node.getChildren) for (const c of node.getChildren()) walk(c);
  };
  for (const r of roots) walk(r);
  if (!meshes.length) {
    for (const r of roots) if (r.getClassName?.() === "Mesh") meshes.push(r);
  }
  console.log("instance roots:", roots.map((r) => r.name));
  console.log("gathered meshes:", meshes.length);
  for (const m of meshes) {
    console.log(" ", meshInfo(m));
  }

  // Simulate syncMaterialsFromContainer
  const sources = container.meshes.filter((m) => !/camera|light/i.test(m.name));
  console.log("\n=== SYNC SIMULATION ===");
  console.log("sources:", sources.map((s) => s.name));
  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i];
    const baseName = mesh.name.replace(/^(?:src-\d+-|preview-|inst-)/, "");
    const source =
      sources.find((s) => s.name === baseName) ?? sources[i] ?? sources[0];
    console.log("mesh", mesh.name, "baseName", baseName, "source", source?.name, "mat", source?.material?.name);
  }

  container.dispose();
  engine.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
