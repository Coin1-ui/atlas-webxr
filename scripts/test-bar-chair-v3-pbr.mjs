/**
 * Bar_chair_V3.glb probe — materials + chrome-wire MR flags for Android 3D preview.
 * Usage: node scripts/test-bar-chair-v3-pbr.mjs [path-to.glb]
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
  process.argv[2] ??
  path.resolve(__dirname, "../public/custom-models/Bar_chair_V3.glb");
const hdrPath = path.resolve(__dirname, "../public/assets/environments/neutral.hdr");

const results = [];
function assert(name, ok) {
  results.push({ name, status: ok ? "pass" : "fail" });
  if (!ok) console.error("FAIL:", name);
}

assert("GLB exists", fs.existsSync(glbPath));
assert("vendored neutral.hdr exists", fs.existsSync(hdrPath));
assert("neutral.hdr size > 100KB", fs.existsSync(hdrPath) && fs.statSync(hdrPath).size > 100_000);

const buf = fs.readFileSync(glbPath);
const engine = new NullEngine();
const scene = new Scene(engine);
const container = await LoadAssetContainerAsync(new Uint8Array(buf), scene, {
  pluginExtension: ".glb",
  name: "Bar_chair_V3.glb",
});

assert("container has 2 materials", container.materials.length === 2);

const wire = container.materials.find((m) => m.name.includes("wire"));
const top = container.materials.find((m) => m.name === "top" || m.name.includes("top"));
assert("wire material present", wire instanceof PBRMaterial);
assert("top material present", top instanceof PBRMaterial);

if (wire instanceof PBRMaterial) {
  assert("wire has metallicTexture", Boolean(wire.metallicTexture));
  assert("wire metallic ~1", (wire.metallic ?? 0) >= 0.85);
  assert("wire roughness low (chrome)", (wire.roughness ?? 1) <= 0.25);
  assert("wire useMetalBlue", wire.useMetallnessFromMetallicTextureBlue === true);
  assert("wire useRoughGreen", wire.useRoughnessFromMetallicTextureGreen === true);
}
if (top instanceof PBRMaterial) {
  assert("top has metallicTexture", Boolean(top.metallicTexture));
  assert("top has albedoTexture", Boolean(top.albedoTexture));
}

const wrapper = new TransformNode("wrapper", scene);
const instance = container.instantiateModelsToScene((n) => `preview-${n}`, true);
for (const root of instance.rootNodes) root.parent = wrapper;

const deep = wrapper.getChildMeshes(false).filter((m) => m instanceof AbstractMesh);
const mats = new Set();
for (const mesh of deep) {
  if (mesh.material instanceof PBRMaterial) mats.add(mesh.material.name.replace(/^preview-/, ""));
}
assert("descendant collect finds 2 PBR mats", mats.size === 2);
assert("collect includes wire", [...mats].some((n) => n.includes("wire")));
assert("collect includes top", [...mats].some((n) => n.includes("top")));

// Chrome vs leather must use different recipes (leather must not get chrome IBL boost).
function isChromeLike(name, metallic, roughness, hasMr) {
  if (/wire_/i.test(name)) return true;
  return hasMr && metallic >= 0.85 && roughness <= 0.25;
}
function isDielectric(name, roughness, chrome) {
  if (chrome) return false;
  if (/^(top|leather|fabric|seat|cushion|cloth|upholstery)/i.test(name)) return true;
  return roughness >= 0.4;
}
function tuneStub(name, metallic, roughness, hasMr, neutralHdr) {
  const chrome = isChromeLike(name, metallic, roughness, hasMr);
  const dielectric = isDielectric(name, roughness, chrome);
  if (chrome) {
    return { environmentIntensity: neutralHdr ? 1.45 : 1.82, specularIntensity: neutralHdr ? 1.35 : 1.48 };
  }
  if (dielectric) {
    return { environmentIntensity: neutralHdr ? 0.92 : 1.05, specularIntensity: 0.88 };
  }
  return { environmentIntensity: 1.15, specularIntensity: 1.0 };
}

if (wire instanceof PBRMaterial && top instanceof PBRMaterial) {
  const wireTune = tuneStub(wire.name, wire.metallic ?? 1, wire.roughness ?? 0, true, true);
  const topTune = tuneStub(top.name, top.metallic ?? 1, top.roughness ?? 1, true, true);
  assert("wire classified chrome", isChromeLike(wire.name, wire.metallic ?? 1, wire.roughness ?? 0, true));
  assert("top classified dielectric", isDielectric(top.name, top.roughness ?? 1, false));
  assert("wire env intensity high", wireTune.environmentIntensity >= 1.35);
  assert("top env intensity low (leather)", topTune.environmentIntensity <= 1.0);
  assert("top specular below wire", topTune.specularIntensity < wireTune.specularIntensity);
}

// Simulate chrome-only boost (no plastic leather)
for (const mat of container.materials) {
  if (!(mat instanceof PBRMaterial) || !mat.metallicTexture) continue;
  mat.useMetallnessFromMetallicTextureBlue = true;
  mat.useRoughnessFromMetallicTextureGreen = true;
  mat.emissiveColor.set(0, 0, 0);
  const chrome = isChromeLike(mat.name, mat.metallic ?? 0, mat.roughness ?? 1, true);
  if (chrome) {
    mat.environmentIntensity = 1.45;
    mat.directIntensity = 1.05;
    mat.specularIntensity = 1.35;
  } else {
    mat.environmentIntensity = 0.92;
    mat.directIntensity = 1.32;
    mat.specularIntensity = 0.88;
  }
}
assert(
  "wire emissive cleared after MR tune",
  wire instanceof PBRMaterial &&
    wire.emissiveColor.r === 0 &&
    wire.emissiveColor.g === 0 &&
    wire.emissiveColor.b === 0
);
if (top instanceof PBRMaterial) {
  assert("top env not chrome-boosted", (top.environmentIntensity ?? 0) <= 1.0);
  assert("top specular soft", (top.specularIntensity ?? 1) <= 0.95);
}

const failed = results.filter((r) => r.status === "fail").length;
console.log(
  JSON.stringify(
    {
      ok: failed === 0,
      failed,
      glbBytes: buf.length,
      hdrBytes: fs.existsSync(hdrPath) ? fs.statSync(hdrPath).size : 0,
      materials: container.materials.map((m) => {
        if (!(m instanceof PBRMaterial)) return { name: m.name, class: m.getClassName() };
        return {
          name: m.name,
          metallic: m.metallic,
          roughness: m.roughness,
          hasMr: Boolean(m.metallicTexture),
          hasAlbedo: Boolean(m.albedoTexture),
        };
      }),
      collectedMats: [...mats],
      results,
    },
    null,
    2
  )
);
engine.dispose();
process.exit(failed ? 1 : 0);
