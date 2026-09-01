const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
]);

const TEXT_EXTENSIONS = [".txt", ".md", ".csv"];

/**
 * Best-effort text extraction for compliance prediction.
 * Plain-text files are read directly; binary uploads produce a descriptive stub.
 */
export async function extractDocumentText(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase();
  const isTextFile =
    TEXT_MIME_TYPES.has(file.type) ||
    TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

  if (isTextFile) {
    const raw = await file.text();
    const trimmed = raw.trim();
    if (trimmed) return trimmed;
  }

  return [
    `Document: ${file.name}`,
    `Format: ${file.type || "application/octet-stream"}`,
    "Construction compliance document submitted for AI regulatory verification.",
  ].join(" ");
}
