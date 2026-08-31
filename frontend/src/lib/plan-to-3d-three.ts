import * as THREE from "three";
import type { BoxDescriptor, FloorDescriptor, GeometryDescriptor } from "@/lib/plan-to-3d";

const DOOR_SWING_RAD = THREE.MathUtils.degToRad(35);

export type DescriptorMaterials = {
  wall: THREE.Material;
  sill: THREE.Material;
  lintel: THREE.Material;
  glass: THREE.Material;
  door: THREE.Material;
  column: THREE.Material;
  columnGold: THREE.Material;
  floor: THREE.Material;
};

export function createDefaultMaterials(): DescriptorMaterials {
  return {
    wall: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.92,
      metalness: 0.02,
    }),
    sill: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.92,
      metalness: 0.02,
    }),
    lintel: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.92,
      metalness: 0.02,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.4,
      roughness: 0.05,
      metalness: 0.1,
    }),
    door: new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.82,
      metalness: 0.02,
    }),
    column: new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.35,
    }),
    columnGold: new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.38,
      metalness: 0.42,
    }),
    floor: new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.88,
      metalness: 0.04,
    }),
  };
}

function materialForRole(
  role: BoxDescriptor["role"],
  materials: DescriptorMaterials,
  useGoldColumn: boolean
): THREE.Material {
  if (role === "column") return useGoldColumn ? materials.columnGold : materials.column;
  if (role === "sill") return materials.sill;
  if (role === "lintel") return materials.lintel;
  if (role === "glass") return materials.glass;
  if (role === "door") return materials.door;
  return materials.wall;
}

function buildFloorMesh(floor: FloorDescriptor, material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  floor.polygon.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: floor.depth,
    bevelEnabled: false,
  });
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  mesh.name = floor.id ?? "floor";
  return mesh;
}

function buildDoorMesh(box: BoxDescriptor, material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.position.set(box.position[0], 0, box.position[2]);
  group.rotation.y = box.rotationY;
  const hinge = new THREE.Group();
  hinge.position.set(-box.size[0] / 2, 0, 0);
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(box.size[0], box.size[1], box.size[2]),
    material
  );
  panel.position.set(box.size[0] / 2, box.size[1] / 2, 0);
  panel.castShadow = true;
  hinge.add(panel);
  hinge.rotation.y = DOOR_SWING_RAD;
  group.add(hinge);
  group.name = `door-${box.id ?? "leaf"}`;
  return group;
}

function buildBoxMesh(
  box: BoxDescriptor,
  material: THREE.Material
): THREE.Object3D {
  if (box.role === "door") return buildDoorMesh(box, material);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(box.size[0], box.size[1], box.size[2]),
    material
  );
  mesh.position.set(box.position[0], box.position[1], box.position[2]);
  mesh.rotation.y = box.rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = `${box.role}-${box.id ?? "piece"}`;
  return mesh;
}

export function instantiateDescriptors(
  root: THREE.Group,
  descriptors: GeometryDescriptor[],
  materials: DescriptorMaterials
): THREE.Object3D[] {
  const objects: THREE.Object3D[] = [];
  for (const descriptor of descriptors) {
    if (descriptor.type === "floor") {
      const mesh = buildFloorMesh(descriptor, materials.floor);
      root.add(mesh);
      objects.push(mesh);
      continue;
    }
    const obj = buildBoxMesh(
      descriptor,
      materialForRole(descriptor.role, materials, descriptor.role === "column")
    );
    root.add(obj);
    objects.push(obj);
  }
  return objects;
}

export function footprintToBox2(footprint: {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}): THREE.Box2 {
  return new THREE.Box2(
    new THREE.Vector2(footprint.minX, footprint.minZ),
    new THREE.Vector2(footprint.maxX, footprint.maxZ)
  );
}
