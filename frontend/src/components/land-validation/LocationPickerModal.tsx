"use client";

import { useEffect, useState } from "react";
import { X, Search, Loader2, MapPin, Crosshair } from "lucide-react";
import { searchPlaces, type Anchor, type GeocodeResult } from "@/lib/land-validation";
import { DynamicLocationPickerMap } from "./DynamicLocationPickerMap";

type Props = {
  open: boolean;
  initial: Anchor | null;
  onClose: () => void;
  onConfirm: (value: Anchor) => void;
};

const round6 = (n: number) => Number(n.toFixed(6));

export function LocationPickerModal({ open, initial, onClose, onConfirm }: Props) {
  const [picked, setPicked] = useState<Anchor | null>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (open) {
      setPicked(initial);
      setQuery("");
      setResults([]);
      setNotice(null);
    }
  }, [open, initial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setNotice(null);
    try {
      const found = await searchPlaces(query.trim());
      setResults(found);
      if (found.length === 0) setNotice("No matching place found");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setNotice("Geolocation is not available in this browser");
      return;
    }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPicked({
          lat: round6(pos.coords.latitude),
          lon: round6(pos.coords.longitude),
        });
        setLocating(false);
      },
      () => {
        setNotice("Could not read your location");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-picker-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#1E1E24]/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close location picker"
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury-lg">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Project Location
            </p>
            <h2
              id="location-picker-title"
              className="mt-0.5 text-lg font-bold text-slate-900"
            >
              Select on map
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-gold hover:text-gold"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <form onSubmit={runSearch} className="flex flex-1 gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a place (e.g. Battaramulla)"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
              />
              <button
                type="submit"
                disabled={searching}
                className="inline-flex items-center gap-1.5 rounded-lg bg-charcoal px-3 py-2 text-sm text-white hover:bg-charcoal-light disabled:opacity-50"
                aria-label="Search"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 text-gold" />
                )}
              </button>
            </form>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:border-gold/40 disabled:opacity-50"
            >
              {locating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Crosshair className="h-4 w-4 text-gold" />
              )}
              My location
            </button>
          </div>

          {notice && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {notice}
            </p>
          )}

          {results.length > 0 && (
            <ul className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-1">
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked({ lat: round6(r.lat), lon: round6(r.lon) });
                      setResults([]);
                    }}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                    <span className="text-slate-600">{r.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="h-[52vh] min-h-[280px]">
            <DynamicLocationPickerMap value={picked} onChange={setPicked} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs text-slate-500">
              {picked
                ? `${picked.lat.toFixed(6)}, ${picked.lon.toFixed(6)}`
                : "Click the map to drop a pin"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!picked}
                onClick={() => picked && onConfirm(picked)}
                className="rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-charcoal-light disabled:opacity-50"
              >
                Use this location
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
