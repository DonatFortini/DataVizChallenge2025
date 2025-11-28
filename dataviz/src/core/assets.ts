const BASE_URL = (import.meta as any).env?.BASE_URL ?? "/";

/**
 * Resolve a public asset (geojson, image, glb) relative to the deployed app location.
 * Handles both absolute bases (e.g. "/DataVizChallenge2025/") and relative bases ("./").
 */
export function assetUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

  if (typeof window === "undefined") {
    return `${BASE_URL}${normalizedPath}`;
  }

  const baseHref = new URL(BASE_URL, window.location.href);
  return new URL(normalizedPath, baseHref).toString();
}

export function baseHref(): string {
  if (typeof window === "undefined") return BASE_URL;
  return new URL(BASE_URL, window.location.href).toString();
}
