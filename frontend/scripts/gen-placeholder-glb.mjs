/**
 * Builds lightweight placeholder BIM house .glb files for the Construction AI
 * viewport. Mesh names (Column_C1 …) are what the clash overlay looks up.
 *
 * Run: node scripts/gen-placeholder-glb.mjs
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Node has Blob but not FileReader — GLTFExporter needs both for binary output.
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    result = null;
    onload = null;
    onerror = null;
    onloadend = null;
    readAsArrayBuffer(blob) {
      Promise.resolve(blob.arrayBuffer())
        .then((buf) => {
          this.result = buf;
          const ev = { target: this };
          this.onload?.(ev);
          this.onloadend?.(ev);
        })
        .catch((err) => {
          this.onerror?.(err);
          this.onloadend?.({ target: this });
        });
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/models");
fs.mkdirSync(outDir, { recursive: true });

const root = new THREE.Group();
root.name = "DefaultHouse";

const plaster = new THREE.MeshStandardMaterial({
  color: 0xf8fafc,
  roughness: 0.88,
  metalness: 0.02,
});
const oak = new THREE.MeshStandardMaterial({
  color: 0x854d0e,
  roughness: 0.7,
  metalness: 0.05,
});
const glass = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  transparent: true,
  opacity: 0.45,
  roughness: 0.1,
  metalness: 0.1,
});
const gold = new THREE.MeshStandardMaterial({
  color: 0xd4af37,
  roughness: 0.38,
  metalness: 0.35,
});
const doorMat = new THREE.MeshStandardMaterial({
  color: 0x78350f,
  roughness: 0.7,
});
const roofMat = new THREE.MeshStandardMaterial({
  color: 0x334155,
  roughness: 0.72,
  metalness: 0.12,
});

function box(name, w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat.clone());
  m.name = name;
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
  return m;
}

box("Floor", 14, 0.2, 14, 0, 0.1, 0, oak);
box("Wall_N", 14, 3, 0.22, 0, 1.6, -7, plaster);
box("Wall_S_L", 5.5, 3, 0.22, -4.25, 1.6, 7, plaster);
box("Wall_S_R", 5.5, 3, 0.22, 4.25, 1.6, 7, plaster);
box("Wall_W", 0.22, 3, 14, -7, 1.6, 0, plaster);
box("Wall_E", 0.22, 3, 14, 7, 1.6, 0, plaster);
box("Wall_Partition", 0.18, 3, 7, 0, 1.6, -3.5, plaster);
box("Window_N1", 1.6, 1.2, 0.08, -3, 1.6, -7.05, glass);
box("Window_N2", 1.6, 1.2, 0.08, 3, 1.6, -7.05, glass);
box("Window_E", 0.08, 1.2, 1.6, 7.05, 1.6, -2, glass);
box("Window_W", 0.08, 1.2, 1.6, -7.05, 1.6, 2, glass);
const door = box("Door_D1", 1.1, 2.1, 0.06, -0.2, 1.05, 7.05, doorMat);
door.rotation.y = 0.55;

for (const [name, x, z] of [
  ["Column_C1", -6.6, -6.6],
  ["Column_C2", 6.6, -6.6],
  ["Column_C3", -6.6, 6.6],
  ["Column_C4", 6.6, 6.6],
]) {
  box(name, 0.36, 3.0, 0.36, x, 1.5, z, gold);
}

const roofL = new THREE.Mesh(new THREE.BoxGeometry(15, 0.12, 8), roofMat.clone());
roofL.name = "Roof_L";
roofL.position.set(0, 3.9, -3.5);
roofL.rotation.x = 0.35;
root.add(roofL);
const roofR = new THREE.Mesh(new THREE.BoxGeometry(15, 0.12, 8), roofMat.clone());
roofR.name = "Roof_R";
roofR.position.set(0, 3.9, 3.5);
roofR.rotation.x = -0.35;
root.add(roofR);

const exporter = new GLTFExporter();

function write(name, object) {
  return new Promise((resolve, reject) => {
    exporter.parse(
      object,
      (result) => {
        const buf = Buffer.from(result);
        const file = path.join(outDir, name);
        fs.writeFileSync(file, buf);
        console.log("wrote", file, buf.length, "bytes");
        resolve();
      },
      (err) => reject(err),
      { binary: true }
    );
  });
}

await write("default_house.glb", root);
await write("southern_farmhouse.glb", root);
await write("test1.glb", root);
console.log("done");
