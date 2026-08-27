"use client";

import { useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

type InputMode = "coordinates" | "address";

export function GeospatialCard() {
  const [mode, setMode] = useState<InputMode>("coordinates");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [address, setAddress] = useState("");

  return (
    <div className="card-luxury flex flex-col">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-charcoal/5">
          <MapPin className="h-5 w-5 text-charcoal" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Geospatial Location
          </h2>
          <p className="text-sm text-slate-500">
            Pin your project site for contextual analysis
          </p>
        </div>
      </div>

      <div className="mb-4 flex rounded-xl border border-slate-200 bg-slate-100 p-1">
        {(["coordinates", "address"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMode(tab)}
            className={cn(
              "min-h-touch flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize transition-all",
              mode === tab
                ? "bg-charcoal text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            {tab === "coordinates" ? "GPS Coordinates" : "Address"}
          </button>
        ))}
      </div>

      {mode === "coordinates" ? (
        <div className="space-y-3">
          <div>
            <label
              htmlFor="latitude"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Latitude
            </label>
            <input
              id="latitude"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 40.7128"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
            />
          </div>
          <div>
            <label
              htmlFor="longitude"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Longitude
            </label>
            <input
              id="longitude"
              type="text"
              inputMode="decimal"
              placeholder="e.g. -74.0060"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
            />
          </div>
        </div>
      ) : (
        <div>
          <label
            htmlFor="address"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            Street Address
          </label>
          <input
            id="address"
            type="text"
            placeholder="123 Construction Ave, New York, NY"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
          />
        </div>
      )}

      <div className="relative mt-4 flex min-h-[120px] items-center justify-center overflow-hidden rounded-xl bg-charcoal">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(212,175,55,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(212,175,55,0.3) 1px, transparent 1px)
            `,
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative flex flex-col items-center gap-2 px-4 text-center">
          <Navigation className="h-6 w-6 text-gold/80" aria-hidden />
          <p className="text-xs font-medium text-slate-400">
            Map preview will appear here
          </p>
          {(latitude || longitude || address) && (
            <p className="text-xs text-gold/90">
              {mode === "coordinates" && latitude && longitude
                ? `${latitude}, ${longitude}`
                : address}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
