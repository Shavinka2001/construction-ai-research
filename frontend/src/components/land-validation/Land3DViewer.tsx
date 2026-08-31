"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";

const FT_TO_M = 0.3048;
const MAX_HEIGHT_M = 35 * FT_TO_M; // 2 storeys / ~10.7 m envelope

function terrainGeometry(transect: number[], extent: number, slopeDeg: number) {
  const seg = 48;
  const geo = new THREE.PlaneGeometry(extent * 2, extent * 2, seg, seg);
  const pos = geo.attributes.position;
  const min = Math.min(...transect);
  const max = Math.max(...transect);
  const range = max - min || 1;
  const slopeGrad = Math.tan((slopeDeg * Math.PI) / 180);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const fx = (x + extent) / (extent * 2); // 0..1 west->east
    const idx = Math.min(transect.length - 1, Math.max(0, fx * (transect.length - 1)));
    const lo = Math.floor(idx);
    const hi = Math.min(transect.length - 1, lo + 1);
    const frac = idx - lo;
    const elev = transect[lo] * (1 - frac) + transect[hi] * frac;
    const normalized = ((elev - min) / range) * Math.min(range, 8);
    const crossFall = (y / extent) * slopeGrad * extent * 0.25;
    const ripple = Math.sin(x * 0.4) * Math.cos(y * 0.35) * 0.25;
    pos.setZ(i, normalized + crossFall + ripple);
  }
  geo.computeVertexNormals();
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function buildEnvelope(polygonM: number[][]) {
  if (!polygonM || polygonM.length < 3) return null;
  const shape = new THREE.Shape();
  polygonM.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: MAX_HEIGHT_M,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function Scene({
  transect,
  slopeDeg,
  buildZonePolygonM,
  lotPolygonM,
}: {
  transect: number[];
  slopeDeg: number;
  buildZonePolygonM: number[][];
  lotPolygonM: number[][];
}) {
  const extent = useMemo(() => {
    const pts = lotPolygonM.length >= 3 ? lotPolygonM : buildZonePolygonM;
    if (!pts || pts.length === 0) return 20;
    const xs = pts.map((p) => Math.abs(p[0]));
    const ys = pts.map((p) => Math.abs(p[1]));
    return Math.max(12, Math.max(...xs, ...ys) * 1.25);
  }, [lotPolygonM, buildZonePolygonM]);

  const terrain = useMemo(
    () => terrainGeometry(transect.length ? transect : [10, 10], extent, slopeDeg),
    [transect, extent, slopeDeg]
  );
  const envelope = useMemo(
    () => buildEnvelope(buildZonePolygonM),
    [buildZonePolygonM]
  );
  const lotLine = useMemo(() => {
    if (!lotPolygonM || lotPolygonM.length < 3) return null;
    const pts = lotPolygonM.map(([x, y]) => new THREE.Vector3(x, 0.05, y));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [lotPolygonM]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[extent, extent * 1.5, extent]} intensity={1.1} />
      <hemisphereLight args={["#cfe8ff", "#3a2f1e", 0.4]} />

      <mesh geometry={terrain} receiveShadow>
        <meshStandardMaterial color="#8a7d5c" flatShading roughness={1} />
      </mesh>

      {lotLine && (
        <lineLoop geometry={lotLine}>
          <lineBasicMaterial color="#D4AF37" linewidth={2} />
        </lineLoop>
      )}

      {envelope && (
        <group>
          <mesh geometry={envelope}>
            <meshStandardMaterial
              color="#22c55e"
              transparent
              opacity={0.32}
              depthWrite={false}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[envelope]} />
            <lineBasicMaterial color="#15803d" />
          </lineSegments>
        </group>
      )}

      <Grid
        args={[extent * 2.4, extent * 2.4]}
        cellSize={2}
        cellColor="#6b7280"
        sectionSize={10}
        sectionColor="#9ca3af"
        position={[0, -0.02, 0]}
        infiniteGrid={false}
        fadeDistance={extent * 4}
      />
      <OrbitControls enableDamping makeDefault />
    </>
  );
}

export function Land3DViewerImpl({
  transect,
  slopeDeg,
  buildZonePolygonM,
  lotPolygonM,
}: {
  transect: number[];
  slopeDeg: number;
  buildZonePolygonM: number[][];
  lotPolygonM: number[][];
}) {
  return (
    <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-sky-100 to-slate-200">
      <Canvas camera={{ position: [28, 26, 34], fov: 45 }} shadows>
        <Scene
          transect={transect}
          slopeDeg={slopeDeg}
          buildZonePolygonM={buildZonePolygonM}
          lotPolygonM={lotPolygonM}
        />
      </Canvas>
    </div>
  );
}
