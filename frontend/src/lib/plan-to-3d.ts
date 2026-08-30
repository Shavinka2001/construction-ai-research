/**
 * Pure 2D floor-plan → 3D geometry descriptors (no Three.js scene access).
 */

export type PlanPoint = { x: number; y: number };

export type PlanWall = {
  id?: string;
  start: PlanPoint;
  end: PlanPoint;
};

export type PlanOpening = {
  id?: string;
  type: "door" | "window";
  center: PlanPoint;
  widthPx: number;
  heightM: number;
  sillM: number;
};

export type PlanColumn = {
  id?: string;
  center: PlanPoint;
  translateX?: number;
  translateY?: number;
  isClash?: boolean;
};

export type FloorPlan = {
  walls: PlanWall[];
  openings: PlanOpening[];
  columns: PlanColumn[];
};

export type GeometryRole =
  | "wall"
  | "sill"
  | "lintel"
  | "glass"
  | "door"
  | "column"
  | "floor";

export type BoxDescriptor = {
  type: "box";
  role: GeometryRole;
  position: [number, number, number];
  rotationY: number;
  size: [number, number, number];
  id?: string;
};

export type FloorDescriptor = {
  type: "floor";
  role: "floor";
  polygon: Array<[number, number]>;
  depth: number;
  id?: string;
};

export type GeometryDescriptor = BoxDescriptor | FloorDescriptor;

export type PlanTransform = {
  unitsToMetres: number;
  centreX: number;
  centreY: number;
};

export type WorldWall = {
  id?: string;
  sx: number;
  sz: number;
  ex: number;
  ez: number;
  length: number;
  rotationY: number;
  dirX: number;
  dirZ: number;
};

export type WallOpening = {
  id?: string;
  type: "door" | "window";
  offsetU: number;
  width: number;
  sill: number;
  height: number;
};

export type CollisionSegment = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  length: number;
  thickness: number;
  doors: Array<{ u0: number; u1: number }>;
};

export type PlanConversionOptions = {
  unitsToMetres?: number;
  weldTolerancePx?: number;
  wallHeight?: number;
  wallThickness?: number;
  floorDepth?: number;
  columnSize?: number;
  openingSnapMaxM?: number;
};

export type PlanConversionResult = {
  descriptors: GeometryDescriptor[];
  collision: CollisionSegment[];
  spawn: [number, number, number];
  footprint: { minX: number; maxX: number; minZ: number; maxZ: number };
  transform: PlanTransform;
  worldWalls: WorldWall[];
  roomCenters: Array<[number, number]>;
  windowCenters: Array<[number, number, number]>;
};

const MIN_DIM = 1e-3;
export const UNITS_TO_METRES = 0.02;
export const WELD_TOLERANCE_PX = 10;
const WALL_HEIGHT = 3.0;
const WALL_THICKNESS = 0.18;
const FLOOR_DEPTH = 0.12;
const COLUMN_SIZE = 0.32;
const OPENING_SNAP_MAX_M = 0.85;
const GLASS_THICKNESS = 0.02;
const DOOR_LEAF_THICKNESS = 0.05;
const COLLISION_PLAYER_RADIUS = 0.3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wallPixelBounds(walls: PlanWall[]) {
  if (walls.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const wall of walls) {
    minX = Math.min(minX, wall.start.x, wall.end.x);
    minY = Math.min(minY, wall.start.y, wall.end.y);
    maxX = Math.max(maxX, wall.start.x, wall.end.x);
    maxY = Math.max(maxY, wall.start.y, wall.end.y);
  }
  return { minX, minY, maxX, maxY };
}

export function createPlanTransform(
  walls: PlanWall[],
  unitsToMetres = UNITS_TO_METRES
): PlanTransform {
  const bounds = wallPixelBounds(walls);
  if (!bounds) return { unitsToMetres, centreX: 0, centreY: 0 };
  return {
    unitsToMetres,
    centreX: (bounds.minX + bounds.maxX) / 2,
    centreY: (bounds.minY + bounds.maxY) / 2,
  };
}

export function planToWorld(
  px: number,
  py: number,
  transform: PlanTransform
): [number, number] {
  return [
    (px - transform.centreX) * transform.unitsToMetres,
    (py - transform.centreY) * transform.unitsToMetres,
  ];
}

export function weldWallEndpoints(
  walls: PlanWall[],
  tolerancePx = WELD_TOLERANCE_PX
): PlanWall[] {
  const anchors: PlanPoint[] = [];
  const snap = (point: PlanPoint): PlanPoint => {
    for (const anchor of anchors) {
      if (Math.hypot(point.x - anchor.x, point.y - anchor.y) <= tolerancePx) {
        return anchor;
      }
    }
    const copy = { x: point.x, y: point.y };
    anchors.push(copy);
    return copy;
  };
  return walls.map((wall) => ({
    ...wall,
    start: snap(wall.start),
    end: snap(wall.end),
  }));
}

export function worldWallsFromPlan(
  walls: PlanWall[],
  transform: PlanTransform
): WorldWall[] {
  const result: WorldWall[] = [];
  for (const wall of walls) {
    const [sx, sz] = planToWorld(wall.start.x, wall.start.y, transform);
    const [ex, ez] = planToWorld(wall.end.x, wall.end.y, transform);
    const dx = ex - sx;
    const dz = ez - sz;
    const length = Math.hypot(dx, dz);
    if (length < MIN_DIM) continue;
    result.push({
      id: wall.id,
      sx,
      sz,
      ex,
      ez,
      length,
      rotationY: -Math.atan2(dz, dx),
      dirX: dx / length,
      dirZ: dz / length,
    });
  }
  return result;
}

function projectPointOnWall(px: number, pz: number, wall: WorldWall) {
  const vx = px - wall.sx;
  const vz = pz - wall.sz;
  const u = clamp(vx * wall.dirX + vz * wall.dirZ, 0, wall.length);
  const cx = wall.sx + wall.dirX * u;
  const cz = wall.sz + wall.dirZ * u;
  return { u, perpDist: Math.hypot(px - cx, pz - cz) };
}

function assignOpeningsToWalls(
  openings: PlanOpening[],
  worldWalls: WorldWall[],
  transform: PlanTransform
): Map<WorldWall, WallOpening[]> {
  const map = new Map<WorldWall, WallOpening[]>();
  for (const opening of openings) {
    const [ox, oz] = planToWorld(opening.center.x, opening.center.y, transform);
    let best: { wall: WorldWall; u: number; perp: number } | null = null;
    for (const wall of worldWalls) {
      const { u, perpDist } = projectPointOnWall(ox, oz, wall);
      if (perpDist <= OPENING_SNAP_MAX_M && (!best || perpDist < best.perp)) {
        best = { wall, u, perp: perpDist };
      }
    }
    if (!best) continue;
    const assigned: WallOpening = {
      id: opening.id,
      type: opening.type,
      offsetU: best.u,
      width: Math.max(MIN_DIM, opening.widthPx * transform.unitsToMetres * 0.92),
      sill: opening.sillM,
      height: opening.heightM,
    };
    const list = map.get(best.wall) ?? [];
    list.push(assigned);
    map.set(best.wall, list);
  }
  return map;
}

type WallPiece = { u0: number; u1: number; v0: number; v1: number };

export function splitWallIntoPieces(
  wallLength: number,
  wallHeight: number,
  openings: WallOpening[]
): WallPiece[] {
  const pieces: WallPiece[] = [];
  let cursor = 0;
  const sorted = [...openings].sort(
    (a, b) => a.offsetU - a.width / 2 - (b.offsetU - b.width / 2)
  );

  for (const opening of sorted) {
    const half = opening.width / 2;
    const u0 = clamp(opening.offsetU - half, 0, wallLength);
    const u1 = clamp(opening.offsetU + half, 0, wallLength);
    if (u1 <= u0 + MIN_DIM || u0 < cursor - MIN_DIM) continue;

    if (u0 - cursor > MIN_DIM) {
      pieces.push({ u0: cursor, u1: u0, v0: 0, v1: wallHeight });
    }
    if (opening.sill > MIN_DIM) {
      pieces.push({ u0, u1, v0: 0, v1: opening.sill });
    }
    const lintelBase = opening.sill + opening.height;
    if (wallHeight - lintelBase > MIN_DIM) {
      pieces.push({ u0, u1, v0: lintelBase, v1: wallHeight });
    }
    cursor = Math.max(cursor, u1);
  }

  if (wallLength - cursor > MIN_DIM) {
    pieces.push({ u0: cursor, u1: wallLength, v0: 0, v1: wallHeight });
  }
  return pieces;
}

function pieceToBox(
  wall: WorldWall,
  piece: WallPiece,
  thickness: number,
  role: GeometryRole
): BoxDescriptor | null {
  const w = piece.u1 - piece.u0;
  const h = piece.v1 - piece.v0;
  if (w < MIN_DIM || h < MIN_DIM) return null;
  const uMid = (piece.u0 + piece.u1) / 2;
  return {
    type: "box",
    role,
    position: [
      wall.sx + wall.dirX * uMid,
      (piece.v0 + piece.v1) / 2,
      wall.sz + wall.dirZ * uMid,
    ],
    rotationY: wall.rotationY,
    size: [w, h, thickness],
    id: wall.id,
  };
}

function emitWallDescriptors(
  wall: WorldWall,
  openings: WallOpening[],
  thickness: number,
  wallHeight: number
): BoxDescriptor[] {
  const boxes: BoxDescriptor[] = [];
  for (const piece of splitWallIntoPieces(wall.length, wallHeight, openings)) {
    let role: GeometryRole = "wall";
    if (piece.v0 === 0 && piece.v1 < wallHeight - MIN_DIM) role = "sill";
    else if (piece.v0 > MIN_DIM) role = "lintel";
    const box = pieceToBox(wall, piece, thickness, role);
    if (box) boxes.push(box);
  }
  for (const opening of openings) {
    const x = wall.sx + wall.dirX * opening.offsetU;
    const z = wall.sz + wall.dirZ * opening.offsetU;
    const y = opening.sill + opening.height / 2;
    boxes.push({
      type: "box",
      role: opening.type === "window" ? "glass" : "door",
      position: [x, y, z],
      rotationY: wall.rotationY,
      size: [
        opening.width,
        opening.height,
        opening.type === "window" ? GLASS_THICKNESS : DOOR_LEAF_THICKNESS,
      ],
      id: opening.id,
    });
  }
  return boxes;
}

export function extractRoomPolygons(
  walls: PlanWall[],
  transform: PlanTransform
): Array<Array<[number, number]>> {
  const bounds = wallPixelBounds(walls);
  if (!bounds) return [];
  const padPx = 8;
  const minX = Math.floor(bounds.minX - padPx);
  const minY = Math.floor(bounds.minY - padPx);
  const maxX = Math.ceil(bounds.maxX + padPx);
  const maxY = Math.ceil(bounds.maxY + padPx);
  const cell = 4;
  const cols = Math.ceil((maxX - minX) / cell);
  const rows = Math.ceil((maxY - minY) / cell);
  if (cols < 2 || rows < 2) return [];

  const blocked = new Uint8Array(cols * rows);
  const wallHalfPx = (WALL_THICKNESS / transform.unitsToMetres) * 0.55;
  const mark = (px: number, py: number) => {
    const gx = Math.floor((px - minX) / cell);
    const gy = Math.floor((py - minY) / cell);
    if (gx >= 0 && gy >= 0 && gx < cols && gy < rows) blocked[gy * cols + gx] = 1;
  };

  for (const wall of walls) {
    const steps = Math.max(
      2,
      Math.ceil(
        Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y) / cell
      )
    );
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = wall.start.x + (wall.end.x - wall.start.x) * t;
      const py = wall.start.y + (wall.end.y - wall.start.y) * t;
      for (let ox = -wallHalfPx; ox <= wallHalfPx; ox += cell * 0.5) {
        for (let oy = -wallHalfPx; oy <= wallHalfPx; oy += cell * 0.5) {
          mark(px + ox, py + oy);
        }
      }
    }
  }

  const visited = new Uint8Array(cols * rows);
  const rooms: Array<Array<[number, number]>> = [];
  const idx = (gx: number, gy: number) => gy * cols + gx;

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const start = idx(gx, gy);
      if (blocked[start] || visited[start]) continue;
      const queue: Array<[number, number]> = [[gx, gy]];
      visited[start] = 1;
      let minGx = gx;
      let maxGx = gx;
      let minGy = gy;
      let maxGy = gy;
      let count = 0;
      while (queue.length) {
        const [cx, cy] = queue.pop()!;
        count++;
        minGx = Math.min(minGx, cx);
        maxGx = Math.max(maxGx, cx);
        minGy = Math.min(minGy, cy);
        maxGy = Math.max(maxGy, cy);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const ni = idx(nx, ny);
          if (blocked[ni] || visited[ni]) continue;
          visited[ni] = 1;
          queue.push([nx, ny]);
        }
      }
      if (count * cell * cell < 200) continue;
      rooms.push([
        planToWorld(minX + minGx * cell, minY + minGy * cell, transform),
        planToWorld(minX + (maxGx + 1) * cell, minY + minGy * cell, transform),
        planToWorld(minX + (maxGx + 1) * cell, minY + (maxGy + 1) * cell, transform),
        planToWorld(minX + minGx * cell, minY + (maxGy + 1) * cell, transform),
      ]);
    }
  }
  return rooms;
}

export function polygonAreaMetresSq(polygon: Array<[number, number]>): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, z1] = polygon[i];
    const [x2, z2] = polygon[(i + 1) % polygon.length];
    sum += x1 * z2 - x2 * z1;
  }
  return Math.abs(sum) / 2;
}

function roomCentroid(polygon: Array<[number, number]>): [number, number] {
  let x = 0;
  let z = 0;
  for (const [px, pz] of polygon) {
    x += px;
    z += pz;
  }
  return [x / polygon.length, z / polygon.length];
}

export function resolveWallCollisions(
  x: number,
  z: number,
  segments: CollisionSegment[]
): [number, number] {
  let px = x;
  let pz = z;
  for (const seg of segments) {
    const dx = seg.bx - seg.ax;
    const dz = seg.bz - seg.az;
    const len2 = dx * dx + dz * dz;
    if (len2 < 1e-8) continue;
    const t = clamp(((px - seg.ax) * dx + (pz - seg.az) * dz) / len2, 0, 1);
    const cx = seg.ax + dx * t;
    const cz = seg.az + dz * t;
    const dist = Math.hypot(px - cx, pz - cz);
    const limit = seg.thickness / 2 + COLLISION_PLAYER_RADIUS;
    if (dist >= limit || dist < 1e-8) continue;
    const u = t * seg.length;
    if (seg.doors.some((d) => u >= d.u0 && u <= d.u1)) continue;
    const push = limit - dist;
    px += ((px - cx) / dist) * push;
    pz += ((pz - cz) / dist) * push;
  }
  return [px, pz];
}

function expandFootprint(
  fp: PlanConversionResult["footprint"],
  x: number,
  z: number,
  pad = 0.35
): void {
  fp.minX = Math.min(fp.minX, x - pad);
  fp.maxX = Math.max(fp.maxX, x + pad);
  fp.minZ = Math.min(fp.minZ, z - pad);
  fp.maxZ = Math.max(fp.maxZ, z + pad);
}

export function convertPlanToGeometry(
  plan: FloorPlan,
  options: PlanConversionOptions = {}
): PlanConversionResult {
  const unitsToMetres = options.unitsToMetres ?? UNITS_TO_METRES;
  const weldTolerancePx = options.weldTolerancePx ?? WELD_TOLERANCE_PX;
  const wallHeight = options.wallHeight ?? WALL_HEIGHT;
  const wallThickness = options.wallThickness ?? WALL_THICKNESS;
  const floorDepth = options.floorDepth ?? FLOOR_DEPTH;
  const columnSize = options.columnSize ?? COLUMN_SIZE;

  const welded = weldWallEndpoints(plan.walls, weldTolerancePx);
  const transform = createPlanTransform(welded, unitsToMetres);
  const worldWalls = worldWallsFromPlan(welded, transform);
  const openingsByWall = assignOpeningsToWalls(plan.openings, worldWalls, transform);

  const descriptors: GeometryDescriptor[] = [];
  const collision: CollisionSegment[] = [];
  const windowCenters: Array<[number, number, number]> = [];
  const footprint = {
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };

  const rooms = extractRoomPolygons(welded, transform);
  const roomCenters = rooms.map(roomCentroid);
  rooms.forEach((polygon, i) => {
    descriptors.push({ type: "floor", role: "floor", polygon, depth: floorDepth, id: `room-${i}` });
    for (const [x, z] of polygon) expandFootprint(footprint, x, z);
  });

  for (const wall of worldWalls) {
    const openings = openingsByWall.get(wall) ?? [];
    descriptors.push(...emitWallDescriptors(wall, openings, wallThickness, wallHeight));
    collision.push({
      ax: wall.sx,
      az: wall.sz,
      bx: wall.ex,
      bz: wall.ez,
      length: wall.length,
      thickness: wallThickness,
      doors: openings
        .filter((o) => o.type === "door")
        .map((o) => ({
          u0: clamp(o.offsetU - o.width / 2, 0, wall.length),
          u1: clamp(o.offsetU + o.width / 2, 0, wall.length),
        })),
    });
    expandFootprint(footprint, wall.sx, wall.sz);
    expandFootprint(footprint, wall.ex, wall.ez);
  }

  for (const opening of plan.openings) {
    if (opening.type !== "window") continue;
    const [x, z] = planToWorld(opening.center.x, opening.center.y, transform);
    windowCenters.push([x, 1.2, z]);
  }

  for (const column of plan.columns) {
    const [x, z] = planToWorld(column.center.x, column.center.y, transform);
    descriptors.push({
      type: "box",
      role: "column",
      position: [x, columnSize / 2, z],
      rotationY: 0,
      size: [columnSize, columnSize, columnSize],
      id: column.id,
    });
    expandFootprint(footprint, x, z);
  }

  if (!Number.isFinite(footprint.minX)) {
    footprint.minX = -2;
    footprint.maxX = 2;
    footprint.minZ = -2;
    footprint.maxZ = 2;
  }

  const spawnRoom = rooms.reduce(
    (best, room) =>
      polygonAreaMetresSq(room) > polygonAreaMetresSq(best) ? room : best,
    rooms[0] ?? [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ]
  );
  const [sx, sz] = roomCenters.length
    ? roomCentroid(spawnRoom)
    : [0, 0];

  return {
    descriptors,
    collision,
    spawn: [sx, 1.62, sz],
    footprint,
    transform,
    worldWalls,
    roomCenters,
    windowCenters,
  };
}

/** Legacy broken conversion for research before/after comparison. */
export function convertPlanToGeometryLegacy(
  plan: FloorPlan,
  options: PlanConversionOptions = {}
): PlanConversionResult {
  const unitsToMetres = options.unitsToMetres ?? UNITS_TO_METRES;
  const wallHeight = options.wallHeight ?? WALL_HEIGHT;
  const wallThickness = options.wallThickness ?? WALL_THICKNESS;
  const transform = createPlanTransform(plan.walls, unitsToMetres);
  const descriptors: GeometryDescriptor[] = [];
  const footprint = {
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };

  for (const wall of plan.walls) {
    const [sx, sz] = planToWorld(wall.start.x, wall.start.y, transform);
    const [ex, ez] = planToWorld(wall.end.x, wall.end.y, transform);
    const length = Math.hypot(ex - sx, ez - sz);
    descriptors.push({
      type: "box",
      role: "wall",
      position: [sx, wallHeight / 2, sz],
      rotationY: 0,
      size: [length, wallHeight, wallThickness],
      id: wall.id,
    });
    expandFootprint(footprint, sx, sz);
    expandFootprint(footprint, ex, ez);
  }

  for (const opening of plan.openings) {
    const [x, z] = planToWorld(opening.center.x, opening.center.y, transform);
    descriptors.push({
      type: "box",
      role: opening.type === "door" ? "door" : "glass",
      position: [x, opening.sillM + opening.heightM / 2, z],
      rotationY: 0,
      size: [opening.widthPx * unitsToMetres, opening.heightM, wallThickness * 0.5],
      id: opening.id,
    });
    expandFootprint(footprint, x, z);
  }

  if (!Number.isFinite(footprint.minX)) {
    footprint.minX = -2;
    footprint.maxX = 2;
    footprint.minZ = -2;
    footprint.maxZ = 2;
  }

  return {
    descriptors,
    collision: [],
    spawn: [0, 1.62, 0],
    footprint,
    transform,
    worldWalls: worldWallsFromPlan(plan.walls, transform),
    roomCenters: [],
    windowCenters: [],
  };
}

export function wallSolidArea(pieces: ReturnType<typeof splitWallIntoPieces>): number {
  return pieces.reduce((s, p) => s + (p.u1 - p.u0) * (p.v1 - p.v0), 0);
}

export function wallOpeningArea(openings: WallOpening[]): number {
  return openings.reduce((s, o) => s + o.width * o.height, 0);
}

export function verifyWallAreaConservation(
  wallLength: number,
  wallHeight: number,
  openings: WallOpening[]
): boolean {
  const solid = wallSolidArea(splitWallIntoPieces(wallLength, wallHeight, openings));
  return Math.abs(solid - (wallLength * wallHeight - wallOpeningArea(openings))) < 1e-6;
}

export function wallDirectionFromRotation(rotationY: number): [number, number] {
  return [Math.cos(rotationY), -Math.sin(rotationY)];
}
