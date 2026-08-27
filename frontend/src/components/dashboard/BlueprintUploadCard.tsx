"use client";

import { useCallback, useState } from "react";
import { FileUp, FileImage, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg";

export function BlueprintUploadCard() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const valid = Array.from(incoming).filter((f) =>
      ACCEPTED_TYPES.includes(f.type)
    );
    if (valid.length) setFiles((prev) => [...prev, ...valid]);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="card-luxury flex flex-col">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10">
          <FileUp className="h-5 w-5 text-gold" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Blueprint Upload
          </h2>
          <p className="text-sm text-slate-500">
            Architectural plans, site drawings &amp; schematics
          </p>
        </div>
      </div>

      <label
        htmlFor="blueprint-upload"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "blueprint-grid relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all duration-300 sm:min-h-[260px]",
          isDragging
            ? "border-gold bg-gold/5 shadow-[inset_0_0_0_1px_#D4AF37]"
            : "border-gold/50 hover:border-gold hover:bg-gold/[0.03]"
        )}
      >
        <input
          id="blueprint-upload"
          type="file"
          className="sr-only"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-white shadow-sm">
          <FileImage className="h-7 w-7 text-gold" aria-hidden />
        </div>
        <p className="mt-4 text-center text-sm font-semibold text-slate-900">
          Drag &amp; drop blueprints here
        </p>
        <p className="mt-1 text-center text-xs text-slate-500">
          PDF or PNG · Max 25 MB per file
        </p>
        <span className="mt-4 rounded-lg border border-gold/40 bg-white px-4 py-2 text-xs font-semibold text-gold transition-colors hover:bg-gold/5">
          Browse Files
        </span>
      </label>

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
            >
              <span className="truncate text-sm text-slate-700">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
