"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Plus,
  Check,
  CheckCircle2,
  MapPin,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { getAuthSession } from "@/lib/auth";
import {
  createProject,
  deleteProject,
  fetchProjects,
  updateProject,
  type Project,
} from "@/lib/projects";
import { listLedgers, type Anchor } from "@/lib/land-validation";
import { cn } from "@/lib/utils";
import { useFeasibility } from "./FeasibilityContext";
import { DynamicLocationPickerMap } from "./DynamicLocationPickerMap";
import { LocationPickerModal } from "./LocationPickerModal";

/** Parse a free-text "lat, lon" (or "lat lon") string into an anchor. */
function parseLatLon(raw: string): Anchor | null {
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function formatLatLon(a: Anchor): string {
  return `${a.lat.toFixed(6)}, ${a.lon.toFixed(6)}`;
}

export function PortfolioTab() {
  const { activeProject, setActiveProject } = useFeasibility();
  const token = getAuthSession()?.token ?? "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / edit form
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const pickedLatLon = useMemo(() => parseLatLon(location), [location]);

  useEffect(() => {
    if (!token) {
      setError("Sign in to load your projects.");
      setLoading(false);
      return;
    }
    fetchProjects(token)
      .then(async (list) => {
        setProjects(list);
        const entries = await Promise.all(
          list.map(async (p) => {
            try {
              const led = await listLedgers(p.id);
              return [p.id, led.length] as const;
            } catch {
              return [p.id, 0] as const;
            }
          })
        );
        setCounts(Object.fromEntries(entries));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [token]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setLocation("");
    setError(null);
  };

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description ?? "");
    setLocation(p.location_gps ?? "");
    setError(null);
    setConfirmDeleteId(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !token) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      location_gps: location.trim() || null,
    };
    try {
      if (editingId != null) {
        const updated = await updateProject(token, editingId, payload);
        setProjects((list) =>
          list.map((p) => (p.id === updated.id ? updated : p))
        );
        if (activeProject?.id === updated.id) setActiveProject(updated);
      } else {
        const created = await createProject(token, payload);
        setProjects((list) => [created, ...list]);
        setCounts((c) => ({ ...c, [created.id]: 0 }));
        setActiveProject(created);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteProject(token, id);
      setProjects((list) => list.filter((p) => p.id !== id));
      setCounts((c) => {
        const next = { ...c };
        delete next[id];
        return next;
      });
      if (activeProject?.id === id) setActiveProject(null);
      if (editingId === id) resetForm();
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  };

  const isEditing = editingId != null;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gold">
            Project Portfolio
          </h2>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading projects…
            </div>
          )}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {!loading && projects.length === 0 && !error && (
            <p className="text-sm text-slate-500">
              No projects yet. Create one to start a feasibility ledger.
            </p>
          )}
          <ul className="space-y-2">
            {projects.map((p) => {
              const active = activeProject?.id === p.id;
              const led = counts[p.id] ?? 0;
              return (
                <li
                  key={p.id}
                  className={cn(
                    "rounded-xl border transition-all",
                    active
                      ? "border-gold/50 bg-gold/10 shadow-luxury"
                      : "border-slate-100 bg-white hover:border-gold/30"
                  )}
                >
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setActiveProject(active ? null : p)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {p.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {p.location_gps || "No location set"} · {led} saved
                        ledger{led === 1 ? "" : "s"}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {active && (
                        <CheckCircle2 className="mr-1 h-4 w-4 text-gold" />
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        aria-label={`Edit ${p.name}`}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId((cur) =>
                            cur === p.id ? null : p.id
                          );
                          setError(null);
                        }}
                        aria-label={`Delete ${p.name}`}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {confirmDeleteId === p.id && (
                    <div className="border-t border-slate-100 px-4 py-3">
                      <p className="text-xs text-slate-600">
                        Delete <strong>{p.name}</strong>?
                        {led > 0 &&
                          ` Its ${led} saved ledger${
                            led === 1 ? "" : "s"
                          } will be removed too.`}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === p.id}
                          onClick={() => void handleDelete(p.id)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {deletingId === p.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="h-fit rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              {isEditing ? "Edit Project" : "New Project"}
            </p>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            )}
          </div>

          <label className="mt-3 block text-xs font-medium text-slate-600">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={255}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
              placeholder="Battaramulla Residence"
            />
          </label>

          <label className="mt-3 block text-xs font-medium text-slate-600">
            Description (optional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={5000}
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
              placeholder="Two-storey residence, 15 perches"
            />
          </label>

          <label className="mt-3 block text-xs font-medium text-slate-600">
            Location / GPS (optional)
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
              placeholder="6.9271, 79.8612"
            />
          </label>

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-gold/40"
          >
            {pickedLatLon ? (
              <>
                <Pencil className="h-3.5 w-3.5 text-gold" /> Edit on map
              </>
            ) : (
              <>
                <MapPin className="h-3.5 w-3.5 text-gold" /> Select on map
              </>
            )}
          </button>

          {pickedLatLon && (
            <div className="mt-2 h-32 w-full overflow-hidden rounded-lg border border-slate-200">
              <DynamicLocationPickerMap value={pickedLatLon} readOnly />
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-charcoal-light disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditing ? (
              <Check className="h-4 w-4 text-gold" />
            ) : (
              <Plus className="h-4 w-4 text-gold" />
            )}
            {isEditing ? "Save changes" : "Create project"}
          </button>
        </form>
      </div>

      <LocationPickerModal
        open={pickerOpen}
        initial={pickedLatLon}
        onClose={() => setPickerOpen(false)}
        onConfirm={(value) => {
          setLocation(formatLatLon(value));
          setPickerOpen(false);
        }}
      />
    </>
  );
}
