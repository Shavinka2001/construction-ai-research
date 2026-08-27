# BIM models for Construction AI

Place industry-standard **glTF / GLB** house exports here. The 3D viewport
loads them via `THREE.GLTFLoader` using the active project name.

## Filename map

| Project name           | Asset                         |
|------------------------|-------------------------------|
| *(default / unknown)*  | `default_house.glb`           |
| Southern Farmhouse     | `southern_farmhouse.glb`      |
| test1                  | `test1.glb`                   |
| Any other name         | `{slug}.glb` then default     |

Override with the `modelUrl` prop if needed.

## Clash overlay mesh naming

Name structural column meshes so the AI clash overlay can find them:

- Preferred: `Column_C1`, `Column_C2`, `Column_C3`, …
- Also accepted: `Pillar_C1`, `C1`, `AI-C1`

When `viewMode === "original"`, clash columns tint **orange**.  
When `viewMode === "corrected"`, they lerp to the GCR delta and tint **emerald** (`#10B981`).

## Regenerating placeholders

```bash
node scripts/gen-placeholder-glb.mjs
```

Replace these placeholders with Revit / SketchUp / Blender exports when ready.
