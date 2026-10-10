"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const GOLD = "#D4AF37";
const EMERALD = "#10B981";
const SLATE = "#64748B";

/** Deterministic massing blocks — no randomness, so SSR and client agree. */
const BLOCKS: readonly {
  position: [number, number, number];
  scale: [number, number, number];
}[] = [
  { position: [0, 0.9, 0], scale: [1.9, 1.8, 1.5] },
  { position: [-1.75, 0.55, 0.45], scale: [1.4, 1.1, 1.2] },
  { position: [1.6, 0.42, -0.6], scale: [1.2, 0.85, 1.4] },
  { position: [0.2, 2.1, -0.35], scale: [1.1, 0.6, 0.9] },
  { position: [-0.95, 0.3, -1.5], scale: [0.9, 0.6, 0.8] },
];

/** Column grid, as the AI-GSL engine would place it: regular bays, clear of openings. */
const COLUMNS: readonly [number, number][] = [
  [-1.6, -1.1],
  [-0.55, -1.1],
  [0.55, -1.1],
  [1.6, -1.1],
  [-1.6, 0],
  [1.6, 0],
  [-1.6, 1.1],
  [-0.55, 1.1],
  [0.55, 1.1],
  [1.6, 1.1],
];

/** Wireframe massing that slowly rotates — the "generative BIM" read. */
function Massing() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    group.current.rotation.y = t * 0.12;
    group.current.position.y = Math.sin(t * 0.55) * 0.06;
  });

  return (
    <group ref={group}>
      {BLOCKS.map((block, index) => (
        <mesh key={index} position={block.position} scale={block.scale}>
          <boxGeometry />
          <meshBasicMaterial
            color={index === 0 ? GOLD : SLATE}
            wireframe
            transparent
            opacity={index === 0 ? 0.85 : 0.42}
          />
        </mesh>
      ))}

      {COLUMNS.map(([x, z], index) => (
        <mesh key={`col-${index}`} position={[x, 0.3, z]}>
          <boxGeometry args={[0.1, 0.6, 0.1]} />
          <meshBasicMaterial color={EMERALD} transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  );
}

/** Gold plane that sweeps up the massing, echoing the plan-scanning pass. */
function ScanPlane() {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.getElapsedTime();
    // 0 -> 3 and back, eased, so the sweep lingers at the extremes.
    mesh.current.position.y = 1.5 + Math.sin(t * 0.6) * 1.5;
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[7, 7]} />
      <meshBasicMaterial
        color={GOLD}
        transparent
        opacity={0.07}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Ground contour grid, standing in for the DEM terrain read. */
function TerrainGrid() {
  const grid = useMemo(() => {
    const helper = new THREE.GridHelper(14, 28, SLATE, SLATE);
    const material = helper.material as THREE.Material;
    material.transparent = true;
    material.opacity = 0.14;
    return helper;
  }, []);

  // GridHelper owns GPU buffers; dispose when the scene unmounts.
  useMemo(() => () => grid.dispose(), [grid]);

  return <primitive object={grid} position={[0, -0.02, 0]} />;
}

/**
 * Decorative hero scene.
 *
 * Mounted only by Hero.tsx behind a dynamic import, on viewports wide enough
 * to warrant it and when reduced motion is not requested. `frameloop="demand"`
 * is deliberately NOT used here because the whole scene is animation; instead
 * the canvas is capped at dpr 1.5 and a low-cost basic-material palette.
 */
export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [4.6, 3.4, 5.4], fov: 42 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <TerrainGrid />
      <Massing />
      <ScanPlane />
    </Canvas>
  );
}
