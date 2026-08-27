"use client";

import { useState } from "react";
import { Layers, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function GisMapCanvas() {
  const [zoom, setZoom] = useState(14);
  const [showContours, setShowContours] = useState(true);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          DEM · Geospatial Intelligence
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">GIS Map Canvas</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Site parcel · Topography overlay · Hazard zones
        </p>
      </div>

      <div className="p-4 sm:p-5">
        <div
          className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#1E1E24]/30"
          role="img"
          aria-label="Simulated satellite map with property boundary, contour lines, and flood zone overlay"
        >
          {/* Satellite imagery placeholder */}
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 60% at 30% 25%, rgba(34, 85, 68, 0.9) 0%, transparent 55%),
                radial-gradient(ellipse 70% 50% at 75% 40%, rgba(45, 74, 62, 0.85) 0%, transparent 50%),
                radial-gradient(ellipse 90% 70% at 50% 70%, rgba(28, 58, 48, 0.95) 0%, transparent 60%),
                linear-gradient(165deg, #1a2e28 0%, #0f1a16 35%, #152420 65%, #0d1814 100%)
              `,
            }}
          />

          {/* Terrain texture noise */}
          <div
            className="absolute inset-0 opacity-[0.15] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* High-risk flood zone — bottom shaded area */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[28%] bg-gradient-to-t from-red-900/55 via-red-800/25 to-transparent"
            aria-hidden
          />
          <div className="absolute bottom-4 left-4 rounded-md bg-red-950/80 px-2 py-1 backdrop-blur-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-300">
              High-Risk Flood Zone
            </span>
          </div>

          {/* Topographical contours (DEM) */}
          {showContours && (
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 400 300"
              preserveAspectRatio="none"
              aria-hidden
            >
              {[55, 75, 95, 115, 135, 155].map((r, i) => (
                <ellipse
                  key={r}
                  cx="200"
                  cy="140"
                  rx={r + i * 8}
                  ry={r * 0.55 + i * 4}
                  fill="none"
                  stroke="#FACC15"
                  strokeWidth="1"
                  strokeDasharray="3 5"
                  opacity={0.35 + i * 0.06}
                />
              ))}
            </svg>
          )}

          {/* Property boundary — gold dashed */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 400 300"
            preserveAspectRatio="none"
            aria-hidden
          >
            <polygon
              points="80,60 320,45 340,220 60,240"
              fill="rgba(212,175,55,0.06)"
              stroke="#D4AF37"
              strokeWidth="2"
              strokeDasharray="8 6"
            />
          </svg>

          {/* Property boundary label */}
          <div className="absolute left-[18%] top-[14%] rounded bg-[#1E1E24]/85 px-2 py-0.5 backdrop-blur-sm">
            <span className="text-[10px] font-semibold text-gold">Property Boundary</span>
          </div>

          {/* Contour legend */}
          {showContours && (
            <div className="absolute right-[12%] top-[18%] rounded bg-[#1E1E24]/85 px-2 py-0.5 backdrop-blur-sm">
              <span className="text-[10px] font-medium text-yellow-300/90">
                DEM Contours
              </span>
            </div>
          )}

          {/* Site pin */}
          <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <span className="absolute -inset-3 animate-ping rounded-full bg-gold/30" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-gold bg-[#1E1E24] shadow-lg shadow-gold/20">
                <div className="h-2 w-2 rounded-full bg-gold" />
              </div>
            </div>
          </div>

          {/* Map controls */}
          <div className="absolute right-3 top-3 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z + 1, 20))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600/50 bg-[#1E1E24]/90 text-slate-300 backdrop-blur-sm transition-colors hover:border-gold/50 hover:text-gold"
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 1, 8))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600/50 bg-[#1E1E24]/90 text-slate-300 backdrop-blur-sm transition-colors hover:border-gold/50 hover:text-gold"
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowContours((v) => !v)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-sm transition-colors",
                showContours
                  ? "border-gold/50 bg-gold/20 text-gold"
                  : "border-slate-600/50 bg-[#1E1E24]/90 text-slate-300 hover:border-gold/50 hover:text-gold"
              )}
              aria-label="Toggle contour lines"
              aria-pressed={showContours}
            >
              <Layers className="h-4 w-4" />
            </button>
          </div>

          {/* Map footer */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#1E1E24]/85 px-3 py-2 backdrop-blur-sm">
            <span className="text-[10px] font-medium text-slate-400">
              Satellite · Zoom {zoom}
            </span>
            <span className="text-[10px] font-semibold text-gold">
              6.8721°N, 79.8612°E
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
