import {
  Boxes,
  Brain,
  Cpu,
  Database,
  Eye,
  Globe2,
  Server,
} from "lucide-react";

import type { StackNode } from "@/components/landing/types";

/**
 * The deployed stack, in data-flow order.
 *
 * `flowsTo` describes the real request path: the browser calls the FastAPI
 * service, which fans out to the perception, geospatial and inference services,
 * and every result is persisted back to Postgres.
 */
export const STACK_NODES: readonly StackNode[] = [
  {
    id: "web",
    label: "Next.js 14",
    role: "App Router, RSC, TypeScript",
    layer: "client",
    icon: Boxes,
    flowsTo: ["api"],
    payload: "Plan uploads, site pins, JWT session",
  },
  {
    id: "viewer",
    label: "Three.js",
    role: "WebGL dollhouse & walkthrough",
    layer: "client",
    icon: Eye,
    flowsTo: ["web"],
    payload: "Wall runs, openings, column grid",
  },
  {
    id: "api",
    label: "Python FastAPI",
    role: "Pydantic contracts, JWT auth",
    layer: "service",
    icon: Server,
    flowsTo: ["perception", "geo", "inference", "db"],
    payload: "Validated job payloads",
  },
  {
    id: "perception",
    label: "YOLOv8 + OpenCV",
    role: "Detection & centreline extraction",
    layer: "intelligence",
    icon: Cpu,
    flowsTo: ["api"],
    payload: "Walls, openings, columns, clashes",
  },
  {
    id: "geo",
    label: "Earth Engine",
    role: "SRTM, WorldCover, Surface Water",
    layer: "intelligence",
    icon: Globe2,
    flowsTo: ["api"],
    payload: "Slope, terrain class, flood band",
  },
  {
    id: "inference",
    label: "scikit-learn",
    role: "Compliance classifier",
    layer: "intelligence",
    icon: Brain,
    flowsTo: ["api"],
    payload: "Risk label + confidence",
  },
  {
    id: "db",
    label: "PostgreSQL",
    role: "Neon serverless, SQLAlchemy 2",
    layer: "persistence",
    icon: Database,
    flowsTo: [],
    payload: "Projects, reports, audit trail",
  },
] satisfies readonly StackNode[];

export const LAYER_LABELS: Record<StackNode["layer"], string> = {
  client: "Presentation",
  service: "Orchestration",
  intelligence: "Intelligence",
  persistence: "Persistence",
};
