/**
 * Verify getChildMeshes(false) collects both Bar-Chair materials.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  NullEngine,
  Scene,
  PBRMaterial,
  TransformNode,
  AbstractMesh,
} from "@babylonjs/core";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const glbPath =
  process.argv[2] ?? path.resolve(__dirname, "../public/custom-models/Bar_chair_V3.glb");

const buf = fs.readFileSync(glbPath);
const engine = new NullEngine();
const scene = new Scene(engine);
const container = await LoadAssetContainerAsync(new Uint8Array(buf), scene, {
  pluginExtension: ".glb",
  name: "Bar_chair_V3.glb",
});
const wrapper = new TransformNode("wrapper", scene);
const instance = container.instantiateModelsToScene((n) => `preview-${n}`, true);
for (const root of instance.rootNodes) root.parent = wrapper;

const direct = wrapper.getChildMeshes(true).map((m) => m.name);
const descendants = wrapper.getChildMeshes(false).map((m) => m.name);
const matsDirect = new Set();
const matsDeep = new Set();
for (const mesh of wrapper.getChildMeshes(true)) {
  if (mesh.material instanceof PBRMaterial) matsDirect.add(mesh.material.name);
}
for (const mesh of wrapper.getChildMeshes(false)) {
  if (mesh.material instanceof PBRMaterial) matsDeep.add(mesh.material.name);
}

console.log(
  JSON.stringify(
    {
      ok: matsDeep.size >= 2 && matsDirect.size < 2,
      directChildren: direct,
      descendants,
      matsDirect: [...matsDirect],
      matsDeep: [...matsDeep],
      materialCount: container.materials.length,
    },
    null,
    2
  )
);
engine.dispose();
process.exit(matsDeep.size >= 2 ? 0 : 1);
