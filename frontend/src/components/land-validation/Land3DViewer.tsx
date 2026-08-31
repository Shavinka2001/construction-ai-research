"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  Compass,
  Hand,
  Home,
  ImageOff,
  Layers,
  Maximize2,
  Minimize2,
  Rotate3d,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { fetchElevationGrid, type DemGrid } from "@/lib/terrain-dem";
import { fetchSiteImagery, IMAGERY_ATTRIBUTION } from "@/lib/terrain-tiles";

const FT_TO_M = 0.3048;
const MAX_HEIGHT_M = 35 * FT_TO_M; // 2 storeys / ~10.7 m envelope
const SEG = 96; // terrain plane subdivisions
const HAZE = "#e4e9ee"; // scene background / fog / terrain-edge fade

type Anchor = { lat: number; lon: number };

// --------------------------------------------------------------------------- //
// Terrain model — one height function shared by the mesh, the contours and the
// drape offsets. Backed by a real DEM grid when available, else the backend
// E–W transect (swept) as a graceful fallback.
// --------------------------------------------------------------------------- //
type TerrainModel = {
  heightAt: (x: number, y: number) => number; // world Y units
  half: number; // context half-span (m)
  isReal: boolean;
  exaggeration: number;
  reliefM: number;
  contourLevels: number[]; // world Y
  contourIntervalM: number;
};

function transectHeightField(transect: number[], half: number, slopeDeg: number) {
  const t = transect.length ? transect : [10, 10];
  const min = Math.min(...t);
  const max = Math.max(...t);
  const range = max - min || 1;
  const vScale = Math.min(range, 8);
  const slopeGrad = Math.tan((slopeDeg * Math.PI) / 180);
  return (x: number, y: number) => {
    const fx = (x + half) / (half * 2);
    const idx = Math.min(t.length - 1, Math.max(0, fx * (t.length - 1)));
    const lo = Math.floor(idx);
    const hi = Math.min(t.length - 1, lo + 1);
    const frac = idx - lo;
    const elev = t[lo] * (1 - frac) + t[hi] * frac;
    const normalized = ((elev - min) / range) * vScale;
    const crossFall = (y / half) * slopeGrad * half * 0.25;
    const ripple = Math.sin(x * 0.4) * Math.cos(y * 0.35) * 0.25;
    return normalized + crossFall + ripple;
  };
}

function contourInterval(reliefM: number): number {
  if (reliefM <= 6) return 1;
  if (reliefM <= 16) return 2;
  if (reliefM <= 45) return 5;
  return 10;
}

function buildTerrainModel(
  dem: DemGrid | null,
  transect: number[],
  slopeDeg: number,
  contextHalf: number
): TerrainModel {
  if (dem) {
    const relief = Math.max(dem.max - dem.min, 0.001);
    const exaggeration = Math.max(
      0.6,
      Math.min(2.4, (contextHalf * 0.16) / Math.max(relief, 0.5))
    );
    const base = dem.min;
    const heightAt = (x: number, y: number) =>
      (dem.sample(x, y) - base) * exaggeration;
    let intervalM = contourInterval(relief);
    while (relief / intervalM > 9) intervalM *= 2; // keep the set readable
    const levels: number[] = [];
    for (
      let m = Math.ceil((base + 1e-3) / intervalM) * intervalM;
      m < dem.max - 1e-3;
      m += intervalM
    ) {
      levels.push((m - base) * exaggeration);
    }
    return {
      heightAt,
      half: contextHalf,
      isReal: true,
      exaggeration,
      reliefM: dem.max - dem.min,
      contourLevels: levels,
      contourIntervalM: intervalM,
    };
  }

  // Fallback: swept transect.
  const hf = transectHeightField(
    transect.length ? transect : [10, 10],
    contextHalf,
    slopeDeg
  );
  const reliefM =
    transect.length > 1 ? Math.max(...transect) - Math.min(...transect) : 1;
  // Sample the field range for evenly-spaced relative contours.
  let fMin = Infinity;
  let fMax = -Infinity;
  for (let i = 0; i <= 24; i++)
    for (let j = 0; j <= 24; j++) {
      const h = hf(-contextHalf + (i / 24) * contextHalf * 2, -contextHalf + (j / 24) * contextHalf * 2);
      if (h < fMin) fMin = h;
      if (h > fMax) fMax = h;
    }
  const span = fMax - fMin;
  const levels =
    span > 1e-3
      ? Array.from({ length: 6 }, (_, k) => fMin + (span * (k + 1)) / 7)
      : [];
  return {
    heightAt: hf,
    half: contextHalf,
    isReal: false,
    exaggeration: 1,
    reliefM,
    contourLevels: levels,
    contourIntervalM: contourInterval(reliefM),
  };
}

// --------------------------------------------------------------------------- //
// Geometry
// --------------------------------------------------------------------------- //
function terrainGeometry(model: TerrainModel) {
  const geo = new THREE.PlaneGeometry(model.half * 2, model.half * 2, SEG, SEG);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, model.heightAt(pos.getX(i), pos.getY(i)));
  }
  geo.computeVertexNormals();
  geo.rotateX(-Math.PI / 2); // (x, y, z) → world (x, z, -y)
  applyEdgeFade(geo, model.half, new THREE.Color(HAZE));
  return geo;
}

const MS_EDGES: number[][] = [
  [], [3, 0], [0, 1], [3, 1], [1, 2], [3, 0, 1, 2], [0, 2], [3, 2],
  [2, 3], [2, 0], [0, 1, 2, 3], [2, 1], [1, 3], [1, 0], [0, 3], [],
];

function contourGeometry(model: TerrainModel) {
  const { heightAt, half, contourLevels } = model;
  if (!contourLevels.length) return null;
  const N = 72;
  const step = (half * 2) / N;
  const grid: number[][] = [];
  for (let i = 0; i <= N; i++) {
    grid[i] = [];
    for (let j = 0; j <= N; j++) grid[i][j] = heightAt(-half + i * step, -half + j * step);
  }
  const lerp = (
    ax: number, ay: number, bx: number, by: number, va: number, vb: number, level: number
  ): [number, number] => {
    const d = vb - va;
    const f = Math.abs(d) < 1e-6 ? 0.5 : (level - va) / d;
    return [ax + (bx - ax) * f, ay + (by - ay) * f];
  };
  const edgePoint = (
    edge: number, x0: number, y0: number, x1: number, y1: number,
    v0: number, v1: number, v2: number, v3: number, level: number
  ): [number, number] => {
    if (edge === 0) return lerp(x0, y0, x1, y0, v0, v1, level);
    if (edge === 1) return lerp(x1, y0, x1, y1, v1, v2, level);
    if (edge === 2) return lerp(x1, y1, x0, y1, v2, v3, level);
    return lerp(x0, y1, x0, y0, v3, v0, level);
  };

  const verts: number[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x0 = -half + i * step;
      const y0 = -half + j * step;
      const x1 = x0 + step;
      const y1 = y0 + step;
      const v0 = grid[i][j];
      const v1 = grid[i + 1][j];
      const v2 = grid[i + 1][j + 1];
      const v3 = grid[i][j + 1];
      for (const level of contourLevels) {
        let idx = 0;
        if (v0 > level) idx |= 1;
        if (v1 > level) idx |= 2;
        if (v2 > level) idx |= 4;
        if (v3 > level) idx |= 8;
        const edges = MS_EDGES[idx];
        for (let e = 0; e < edges.length; e += 2) {
          const p1 = edgePoint(edges[e], x0, y0, x1, y1, v0, v1, v2, v3, level);
          const p2 = edgePoint(edges[e + 1], x0, y0, x1, y1, v0, v1, v2, v3, level);
          verts.push(p1[0], level + 0.04, -p1[1], p2[0], level + 0.04, -p2[1]);
        }
      }
    }
  }
  if (!verts.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  return g;
}

/**
 * Per-vertex colour that lerps the terrain toward the haze colour across the
 * outer ring, so the opaque plane dissolves into the fog instead of ending on a
 * hard rectangle — without the depth-sort artefacts a transparent terrain
 * would cause with the massing prism drawn over it.
 */
function applyEdgeFade(geo: THREE.BufferGeometry, half: number, haze: THREE.Color) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const white = new THREE.Color(1, 1, 1);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // geometry is already rotated: plane spans x,z ∈ [-half, half]
    const r = Math.max(Math.abs(pos.getX(i)), Math.abs(pos.getZ(i))) / half;
    const t = Math.min(1, Math.max(0, (r - 0.62) / 0.34));
    tmp.copy(white).lerp(haze, t * t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

/** Strip a duplicated closing vertex if the ring carries one. */
function openRing(polygonM: number[][]): number[][] {
  if (polygonM.length < 2) return polygonM;
  const a = polygonM[0];
  const b = polygonM[polygonM.length - 1];
  return a[0] === b[0] && a[1] === b[1] ? polygonM.slice(0, -1) : polygonM;
}

function ringPoints(
  polygonM: number[][],
  offset: number,
  heightAt: (x: number, y: number) => number
): THREE.Vector3[] | null {
  if (!polygonM || polygonM.length < 3) return null;
  return polygonM.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + offset, -z));
}

/** Terrain height range beneath a footprint (samples vertices + centre). */
function groundRange(
  polygonM: number[][],
  heightAt: (x: number, y: number) => number
): { lo: number; hi: number } {
  if (!polygonM || polygonM.length < 3) return { lo: 0, hi: 0 };
  let lo = Infinity;
  let hi = -Infinity;
  let cx = 0;
  let cz = 0;
  for (const [x, z] of polygonM) {
    const h = heightAt(x, z);
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
    cx += x;
    cz += z;
  }
  const hc = heightAt(cx / polygonM.length, cz / polygonM.length);
  lo = Math.min(lo, hc);
  hi = Math.max(hi, hc);
  return Number.isFinite(lo) ? { lo, hi } : { lo: 0, hi: 0 };
}

/**
 * Massing volume for the buildable envelope: the bottom face is draped on the
 * terrain (vertex heights follow the ground) and the roof is a flat slab at
 * `roofY`. The base can never float or sink because it is the terrain surface.
 * Returns the solid geometry plus a matching edges geometry.
 */
function envelopeMass(
  polygonM: number[][],
  heightAt: (x: number, y: number) => number,
  roofY: number
): {
  solid: THREE.BufferGeometry;
  edges: THREE.BufferGeometry;
  floor: THREE.BufferGeometry;
} | null {
  const ring = openRing(polygonM);
  if (!ring || ring.length < 3) return null;
  const n = ring.length;

  const bottom = ring.map(
    ([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.15, -z)
  );
  const top = ring.map(([x, z]) => new THREE.Vector3(x, roofY, -z));

  const verts: number[] = [];
  const push = (v: THREE.Vector3) => verts.push(v.x, v.y, v.z);

  // Side walls
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    push(bottom[i]);
    push(bottom[j]);
    push(top[j]);
    push(bottom[i]);
    push(top[j]);
    push(top[i]);
  }
  // Flat roof (fan)
  for (let i = 1; i < n - 1; i++) {
    push(top[0]);
    push(top[i]);
    push(top[i + 1]);
  }

  const solid = new THREE.BufferGeometry();
  solid.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  solid.computeVertexNormals();

  // Terrain-hugging footprint pad — anchors the massing to the ground.
  const floorV: number[] = [];
  const drape = ring.map(
    ([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.12, -z)
  );
  for (let i = 1; i < n - 1; i++) {
    floorV.push(
      drape[0].x, drape[0].y, drape[0].z,
      drape[i].x, drape[i].y, drape[i].z,
      drape[i + 1].x, drape[i + 1].y, drape[i + 1].z
    );
  }
  const floor = new THREE.BufferGeometry();
  floor.setAttribute("position", new THREE.Float32BufferAttribute(floorV, 3));
  floor.computeVertexNormals();

  // Edges: bottom ring, top ring, verticals
  const edgeV: number[] = [];
  const seg = (a: THREE.Vector3, b: THREE.Vector3) => {
    edgeV.push(a.x, a.y, a.z, b.x, b.y, b.z);
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    seg(bottom[i], bottom[j]);
    seg(top[i], top[j]);
    seg(bottom[i], top[i]);
  }
  const edges = new THREE.BufferGeometry();
  edges.setAttribute("position", new THREE.Float32BufferAttribute(edgeV, 3));

  return { solid, edges, floor };
}

// --------------------------------------------------------------------------- //
// Imperative camera API bridged out of the Canvas
// --------------------------------------------------------------------------- //
export type ViewerApi = {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  fit: () => void;
  toggleAutoRotate: () => boolean;
  setPanMode: (on: boolean) => void;
};

type ControlsLike = {
  target: THREE.Vector3;
  update: () => void;
  reset: () => void;
  autoRotate: boolean;
  getAzimuthalAngle: () => number;
  mouseButtons: { LEFT: number; MIDDLE: number; RIGHT: number };
};

function ViewerRig({
  apiRef,
  compassRef,
  camPos,
  camTarget,
}: {
  apiRef: React.MutableRefObject<ViewerApi | null>;
  compassRef: React.MutableRefObject<HTMLDivElement | null>;
  camPos: [number, number, number];
  camTarget: [number, number, number];
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;

  useEffect(() => {
    if (!controls) return;
    const target = new THREE.Vector3(...camTarget);
    const dolly = (factor: number) => {
      const offset = camera.position.clone().sub(controls.target);
      camera.position.copy(controls.target).add(offset.multiplyScalar(factor));
      controls.update();
    };
    apiRef.current = {
      zoomIn: () => dolly(0.82),
      zoomOut: () => dolly(1.22),
      reset: () => controls.reset(),
      fit: () => {
        controls.target.copy(target);
        camera.position.set(camPos[0], camPos[1], camPos[2]);
        controls.update();
      },
      toggleAutoRotate: () => {
        controls.autoRotate = !controls.autoRotate;
        return controls.autoRotate;
      },
      setPanMode: (on: boolean) => {
        controls.mouseButtons = {
          LEFT: on ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: on ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
        };
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [controls, camera, camPos, camTarget, apiRef]);

  useFrame(() => {
    if (compassRef.current && controls) {
      compassRef.current.style.transform = `rotate(${-controls.getAzimuthalAngle()}rad)`;
    }
  });

  return null;
}

// --------------------------------------------------------------------------- //
// Scene
// --------------------------------------------------------------------------- //
function Scene({
  model,
  texture,
  buildZonePolygonM,
  lotPolygonM,
  showContours,
  camTarget,
  siteHalf,
}: {
  model: TerrainModel;
  texture: THREE.Texture | null;
  buildZonePolygonM: number[][];
  lotPolygonM: number[][];
  showContours: boolean;
  camTarget: [number, number, number];
  siteHalf: number;
}) {
  const { half, heightAt } = model;

  const terrain = useMemo(() => terrainGeometry(model), [model]);
  const contours = useMemo(() => contourGeometry(model), [model]);
  // Buildable-envelope massing: bottom draped on terrain, flat roof one storey
  // set above the highest ground under the footprint.
  const mass = useMemo(() => {
    const { hi } = groundRange(buildZonePolygonM, heightAt);
    const buildingH = MAX_HEIGHT_M * Math.min(model.exaggeration, 1.5);
    return envelopeMass(buildZonePolygonM, heightAt, hi + buildingH);
  }, [buildZonePolygonM, heightAt, model.exaggeration]);
  const lotLine = useMemo(() => {
    const pts = ringPoints(lotPolygonM, 0.4, heightAt);
    return pts ? new THREE.BufferGeometry().setFromPoints(pts) : null;
  }, [lotPolygonM, heightAt]);
  const buildLine = useMemo(() => {
    const pts = ringPoints(buildZonePolygonM, 0.32, heightAt);
    return pts ? new THREE.BufferGeometry().setFromPoints(pts) : null;
  }, [buildZonePolygonM, heightAt]);
  const cornerPts = useMemo(
    () =>
      openRing(lotPolygonM).length >= 3
        ? openRing(lotPolygonM).map(
            ([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.4, -z)
          )
        : [],
    [lotPolygonM, heightAt]
  );

  useEffect(() => {
    return () => {
      terrain.dispose();
      contours?.dispose();
      mass?.solid.dispose();
      mass?.edges.dispose();
      mass?.floor.dispose();
      lotLine?.dispose();
      buildLine?.dispose();
    };
  }, [terrain, contours, mass, lotLine, buildLine]);

  return (
    <>
      <color attach="background" args={[HAZE]} />
      <fog attach="fog" args={[HAZE, half * 0.75, half * 1.4]} />

      <ambientLight intensity={0.72} />
      <hemisphereLight args={["#eef4ff", "#7a7566", 0.4]} />
      <directionalLight
        position={[-half * 0.7, half * 1.4, half * 0.5]}
        intensity={0.85}
      />

      <mesh geometry={terrain}>
        {texture ? (
          <meshStandardMaterial map={texture} vertexColors roughness={1} metalness={0} />
        ) : (
          <meshStandardMaterial color="#8f8468" vertexColors flatShading roughness={1} />
        )}
      </mesh>

      {showContours && contours && (
        <lineSegments geometry={contours} renderOrder={1}>
          <lineBasicMaterial
            color="#f8fafc"
            transparent
            opacity={texture ? 0.38 : 0.26}
            depthWrite={false}
          />
        </lineSegments>
      )}

      {buildLine && (
        <lineLoop geometry={buildLine} renderOrder={2}>
          <lineBasicMaterial color="#16a34a" />
        </lineLoop>
      )}
      {lotLine && (
        <lineLoop geometry={lotLine} renderOrder={3}>
          <lineBasicMaterial color="#f5b301" />
        </lineLoop>
      )}
      {cornerPts.map((p, i) => (
        <mesh key={i} position={p} renderOrder={4}>
          <sphereGeometry args={[Math.max(0.7, siteHalf * 0.028), 14, 14]} />
          <meshBasicMaterial color="#f5b301" />
        </mesh>
      ))}

      {mass && (
        <group renderOrder={2}>
          <mesh geometry={mass.floor} renderOrder={2}>
            <meshBasicMaterial
              color="#22c06a"
              transparent
              opacity={0.24}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh geometry={mass.solid}>
            <meshStandardMaterial
              color="#3bd587"
              transparent
              opacity={0.13}
              depthWrite={false}
            />
          </mesh>
          <lineSegments geometry={mass.edges} renderOrder={3}>
            <lineBasicMaterial color="#0b7a38" />
          </lineSegments>
        </group>
      )}

      <OrbitControls
        makeDefault
        enableDamping
        target={camTarget}
        autoRotateSpeed={0.85}
        minDistance={siteHalf * 0.7}
        maxDistance={siteHalf * 9}
        maxPolarAngle={Math.PI / 2.03}
      />
    </>
  );
}

// --------------------------------------------------------------------------- //
// Overlay chrome
// --------------------------------------------------------------------------- //
function ControlButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md border text-slate-600 shadow-sm backdrop-blur transition-colors",
        active
          ? "border-gold bg-gold/20 text-slate-900"
          : "border-slate-200 bg-white/90 hover:bg-white"
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function LegendRow({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex h-3 w-4 shrink-0 items-center justify-center">{swatch}</span>
      <span>{label}</span>
    </li>
  );
}

// --------------------------------------------------------------------------- //
// Public component
// --------------------------------------------------------------------------- //
type Status = "loading" | "ok" | "unavailable";

export function Land3DViewerImpl({
  transect,
  slopeDeg,
  elevationM,
  anchor,
  buildZonePolygonM,
  lotPolygonM,
}: {
  transect: number[];
  slopeDeg: number;
  elevationM: number;
  anchor: Anchor | null;
  buildZonePolygonM: number[][];
  lotPolygonM: number[][];
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ViewerApi | null>(null);
  const compassRef = useRef<HTMLDivElement | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);

  const [fullscreen, setFullscreen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [showContours, setShowContours] = useState(true);

  const [dem, setDem] = useState<DemGrid | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [demStatus, setDemStatus] = useState<Status>("loading");
  const [imgStatus, setImgStatus] = useState<Status>("loading");

  // --- site framing ------------------------------------------------------- //
  const { siteHalf, contextHalf } = useMemo(() => {
    const pts = lotPolygonM.length >= 3 ? lotPolygonM : buildZonePolygonM;
    let lotHalf = 18;
    if (pts && pts.length) {
      const xs = pts.map((p) => Math.abs(p[0]));
      const ys = pts.map((p) => Math.abs(p[1]));
      lotHalf = Math.max(...xs, ...ys);
    }
    const site = Math.max(lotHalf * 1.15, 20);
    const ctx = lotHalf < 45 ? 4.0 : lotHalf < 120 ? 2.9 : 2.2;
    return { siteHalf: site, contextHalf: Math.round(site * ctx) };
  }, [lotPolygonM, buildZonePolygonM]);

  // --- fetch imagery + DEM for the parcel ------------------------------- //
  useEffect(() => {
    if (!anchor) {
      setDemStatus("unavailable");
      setImgStatus("unavailable");
      return;
    }
    const ctrl = new AbortController();
    let active = true;
    setDemStatus("loading");
    setImgStatus("loading");

    fetchElevationGrid(anchor.lat, anchor.lon, contextHalf, elevationM, ctrl.signal)
      .then((g) => {
        if (!active) return;
        setDem(g);
        setDemStatus("ok");
      })
      .catch((e) => {
        if (!active || e?.name === "AbortError") return;
        setDem(null);
        setDemStatus("unavailable");
      });

    fetchSiteImagery(anchor.lat, anchor.lon, contextHalf, ctrl.signal)
      .then((img) => {
        if (!active) {
          return;
        }
        const tex = new THREE.CanvasTexture(img.canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        textureRef.current?.dispose();
        textureRef.current = tex;
        setTexture(tex);
        setImgStatus("ok");
      })
      .catch((e) => {
        if (!active || e?.name === "AbortError") return;
        setImgStatus("unavailable");
      });

    return () => {
      active = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor?.lat, anchor?.lon, contextHalf, elevationM]);

  // Release the GPU texture when the parcel changes or the viewer unmounts.
  useEffect(() => {
    return () => {
      textureRef.current?.dispose();
      textureRef.current = null;
    };
  }, []);

  const model = useMemo(
    () => buildTerrainModel(dem, transect, slopeDeg, contextHalf),
    [dem, transect, slopeDeg, contextHalf]
  );

  // --- camera pose ------------------------------------------------------- //
  // Frame the parcel + its massing (roughly 1 storey above mid-relief).
  const buildingH = useMemo(
    () => MAX_HEIGHT_M * Math.min(model.exaggeration, 1.5),
    [model.exaggeration]
  );
  const midH = useMemo(
    () => model.reliefM * model.exaggeration * 0.3,
    [model.reliefM, model.exaggeration]
  );
  const camTarget = useMemo<[number, number, number]>(
    () => [0, midH + buildingH * 0.4, 0],
    [midH, buildingH]
  );
  const camDist = useMemo(
    () => Math.max(siteHalf * 3.4, (midH + buildingH) * 2.6),
    [siteHalf, midH, buildingH]
  );
  const camPos = useMemo<[number, number, number]>(() => {
    const polar = (48 * Math.PI) / 180; // from vertical → ~42° above horizon
    const az = (26 * Math.PI) / 180;
    const ty = midH + buildingH * 0.4;
    return [
      Math.sin(polar) * Math.sin(az) * camDist,
      Math.cos(polar) * camDist + ty,
      Math.sin(polar) * Math.cos(az) * camDist,
    ];
  }, [camDist, midH, buildingH]);
  const farPlane = useMemo(() => camDist * 6 + contextHalf * 3, [camDist, contextHalf]);

  // --- transect elevation range (kept identical to the Elevation card) --- //
  const elevation = useMemo(() => {
    if (!transect.length) return null;
    return { min: Math.min(...transect), max: Math.max(...transect) };
  }, [transect]);

  useEffect(() => {
    const onChange = () =>
      setFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapperRef.current?.requestFullscreen?.();
  }, []);

  const loading = demStatus === "loading" || imgStatus === "loading";

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#dfe4ea]",
        fullscreen ? "h-screen" : "h-[440px] lg:h-[520px]"
      )}
    >
      <Canvas
        camera={{ position: camPos, fov: 45, near: 0.5, far: farPlane }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.NoToneMapping,
        }}
        dpr={[1, 1.75]}
      >
        <Scene
          model={model}
          texture={texture}
          buildZonePolygonM={buildZonePolygonM}
          lotPolygonM={lotPolygonM}
          showContours={showContours}
          camTarget={camTarget}
          siteHalf={siteHalf}
        />
        <ViewerRig
          apiRef={apiRef}
          compassRef={compassRef}
          camPos={camPos}
          camTarget={camTarget}
        />
      </Canvas>

      {/* Elevation range (matches the Elevation analysis card) */}
      {elevation && (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <div className="rounded-md border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur">
            <span className="font-bold text-slate-900">↑ {elevation.max.toFixed(0)} m</span>
            <span className="ml-1 text-slate-500">Highest</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur">
            <span className="font-bold text-slate-900">↓ {elevation.min.toFixed(0)} m</span>
            <span className="ml-1 text-slate-500">Lowest</span>
          </div>
        </div>
      )}

      {/* Status chips */}
      <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-1">
        {loading && (
          <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur">
            Loading site imagery &amp; elevation…
          </span>
        )}
        {!loading && imgStatus === "unavailable" && (
          <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1 text-[11px] font-medium text-amber-800 shadow-sm backdrop-blur">
            <ImageOff className="h-3.5 w-3.5" />
            Satellite imagery unavailable — showing elevation terrain
          </span>
        )}
      </div>

      {/* Control cluster */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <ControlButton icon={ZoomIn} label="Zoom in" onClick={() => apiRef.current?.zoomIn()} />
        <ControlButton icon={ZoomOut} label="Zoom out" onClick={() => apiRef.current?.zoomOut()} />
        <ControlButton icon={Home} label="Fit to site" onClick={() => apiRef.current?.fit()} />
        <ControlButton
          icon={Rotate3d}
          label="Toggle auto-rotate"
          active={rotating}
          onClick={() => setRotating(apiRef.current?.toggleAutoRotate() ?? false)}
        />
        <ControlButton
          icon={Hand}
          label={panMode ? "Left drag pans (click to rotate)" : "Left drag rotates (click to pan)"}
          active={panMode}
          onClick={() => {
            const next = !panMode;
            setPanMode(next);
            apiRef.current?.setPanMode(next);
          }}
        />
        <ControlButton
          icon={Layers}
          label="Toggle contour lines"
          active={showContours}
          onClick={() => setShowContours((v) => !v)}
        />
        <ControlButton
          icon={fullscreen ? Minimize2 : Maximize2}
          label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={toggleFullscreen}
        />
      </div>

      {/* Compass */}
      <div className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/90 shadow-sm backdrop-blur">
        <div ref={compassRef} className="relative h-full w-full">
          <span className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[10px] font-bold text-gold-dark">
            N
          </span>
          <Compass className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 rounded-lg border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Legend</p>
        <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
          <LegendRow swatch={<span className="h-0.5 w-4 rounded bg-[#f5b301]" />} label="Lot boundary" />
          <LegendRow
            swatch={<span className="h-0.5 w-4 rounded bg-emerald-600" />}
            label="Buildable envelope"
          />
          <LegendRow
            swatch={<span className="h-3 w-3 rounded-sm border border-emerald-800 bg-emerald-500/30" />}
            label="Max build envelope (≤2 storeys)"
          />
          <LegendRow
            swatch={<span className="h-0.5 w-4 rounded bg-white ring-1 ring-slate-300" />}
            label={`Contours (${model.contourIntervalM} m)`}
          />
        </ul>
        <p className="mt-1.5 max-w-[210px] text-[10px] leading-tight text-slate-400">
          {dem
            ? dem.source === "terrain-tiles"
              ? "SRTM 30 m terrain"
              : "Copernicus 90 m terrain"
            : "E–W transect (terrain grid unavailable)"}
          {model.exaggeration >= 1.3
            ? ` · ${model.exaggeration.toFixed(1)}× vertical`
            : ""}
          {" · "}
          {imgStatus === "ok" ? IMAGERY_ATTRIBUTION : "no imagery"}
        </p>
      </div>
    </div>
  );
}
