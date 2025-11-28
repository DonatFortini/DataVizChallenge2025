const BASE_URL = (import.meta as any).env?.BASE_URL ?? "/";
const ASSET_PREFIX = "data/";

const isExternal = (path: string) => /^https?:\/\//i.test(path);
const withAssetPrefix = (path: string) => {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  if (isExternal(normalized)) return normalized;
  return normalized.startsWith(ASSET_PREFIX) ? normalized : `${ASSET_PREFIX}${normalized}`;
};

/**
 * Resolve a public asset (geojson, image, glb) relative to the deployed app location.
 * Handles both absolute bases (e.g. "/DataVizChallenge2025/") and relative bases ("./").
 */
export function assetUrl(path: string): string {
  if (isExternal(path)) return path;
  const normalizedPath = withAssetPrefix(path);

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
