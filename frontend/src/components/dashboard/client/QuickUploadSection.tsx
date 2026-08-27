"use client";

import { useCallback, useState } from "react";
import { FileImage, FileUp, MapPin, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuickUploadSection() {
  const [isDragging, setIsDragging] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Compact blueprint uploader */}
      <label
        htmlFor="dashboard-blueprint-upload"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "group flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white p-5 transition-all duration-300",
          isDragging
            ? "border-gold bg-gold/5 shadow-[inset_0_0_0_1px_#D4AF37]"
            : "border-gold/40 hover:border-gold hover:shadow-luxury"
        )}
        style={{
          backgroundImage: `
            linear-gradient(rgba(212,175,55,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,175,55,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "16px 16px",
        }}
      >
        <input
          id="dashboard-blueprint-upload"
          type="file"
          className="sr-only"
          accept=".pdf,.png,.jpg,.jpeg"
          multiple
        />
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/30 bg-white shadow-sm transition-transform group-hover:scale-105">
          <FileUp className="h-5 w-5 text-gold" aria-hidden />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-800">
          Drop blueprints here
        </p>
        <p className="mt-1 text-xs text-slate-500">PDF · PNG · JPG</p>
        <span className="mt-3 flex items-center gap-1.5 text-xs font-medium text-gold">
          <FileImage className="h-3.5 w-3.5" aria-hidden />
          Browse files
        </span>
      </label>

      {/* Compact geospatial input */}
      <div className="flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/5">
            <MapPin className="h-4 w-4 text-brand-primary" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Site Location</p>
            <p className="text-xs text-slate-500">GPS or address pin</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="dash-lat"
              className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500"
            >
              Latitude
            </label>
            <input
              id="dash-lat"
              type="text"
              inputMode="decimal"
              placeholder="6.9271"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/10"
            />
          </div>
          <div>
            <label
              htmlFor="dash-lng"
              className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500"
            >
              Longitude
            </label>
            <input
              id="dash-lng"
              type="text"
              inputMode="decimal"
              placeholder="79.8612"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/10"
            />
          </div>
        </div>

        <div className="relative mt-4 flex min-h-[88px] flex-1 items-center justify-center overflow-hidden rounded-xl bg-brand-primary">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(rgba(212,175,55,0.35) 1px, transparent 1px),
                linear-gradient(90deg, rgba(212,175,55,0.35) 1px, transparent 1px)
              `,
              backgroundSize: "20px 20px",
            }}
          />
          <div className="relative flex flex-col items-center gap-1 text-center">
            <Navigation className="h-5 w-5 text-gold/80" aria-hidden />
            <p className="text-[10px] font-medium text-slate-400">Map preview</p>
            {latitude && longitude && (
              <p className="text-[10px] text-gold/90">
                {latitude}, {longitude}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
