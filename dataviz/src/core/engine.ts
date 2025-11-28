import { ALL_CATEGORY, ObjectKeyfromProps, Point, type Commune, type Coordinates, type QueryObject, type DatasetKey } from "./types";
import { point as turfPoint } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { communes } from "./communes.data";

import { roadDistancesFrom, FALLBACK_DISTANCE_KM } from "./distance";
import { assetUrl } from "./assets";

const geojsonCache = new Map<string, Promise<any>>();

const EARTH_RADIUS_KM = 6371;

export async function loadGeoJSON(path: string): Promise<any> {
    if (!geojsonCache.has(path)) {
        geojsonCache.set(
            path,
            fetch(assetUrl(path)).then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load GeoJSON "${path}" (${response.status})`);
                }
                return response.json();
            })
        );
    }
    return geojsonCache.get(path)!;
}

function parseCoordinates(raw: unknown): Coordinates {
    const toNumbers = (values: unknown[]): [number, number] | null => {
        if (values.length < 2) return null;
        const first = Number(values[0]);
        const second = Number(values[1]);
        if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
        return [first, second];
    };

    if (typeof raw === "string") {
        const parts = raw.split(",").map((v) => v.trim());
        const coords = toNumbers(parts);
        if (coords) return coords;
    } else if (Array.isArray(raw)) {
        const coords = toNumbers(raw);
        if (coords) return coords;
    }

    throw new Error(`Invalid coordinates: ${String(raw)}`);
}

function haversineKm(a: Point, b: Point): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);

    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);

    const h =
        sinLat * sinLat +
        Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function neighbouringCommunes(communeName: string): string[] {
    const commune = communes.find((c) => c.nom === communeName);
    if (!commune || !Array.isArray(commune.voisins)) return [];
    return Array.from(new Set(commune.voisins));
}

export async function isInCorsica(pointWGS84: Point): Promise<boolean> {
    const geojson = await loadGeoJSON("corse.geojson");
    const corsicaFeature = geojson.features[0];

    const lambertCoords = pointWGS84.toLambert();
    const lambertPoint = turfPoint(lambertCoords);

    return booleanPointInPolygon(lambertPoint, corsicaFeature);
}

export async function getCommune(pointWGS84: Point): Promise<Commune> {
    if (!(await isInCorsica(pointWGS84))) {
        throw new Error("Point is not in Corsica");
    }

    const geojson = await loadGeoJSON("communes.geojson");
    const lambertCoords = pointWGS84.toLambert();
    const lambertPoint = turfPoint(lambertCoords);

    for (const feature of geojson.features) {
        if (booleanPointInPolygon(lambertPoint, feature)) {
            const communeName: string = feature.properties.nom;
            return {
                name: communeName,
                neighbours: neighbouringCommunes(communeName),
                polygon: feature.geometry,
            };
        }
    }

    throw new Error("No commune found for the given point");
}

const objectsCache = new Map<string, Promise<QueryObject[]>>();
const closestCache = new Map<string, Promise<QueryObject[]>>();

function objectsCacheKey(dataset: DatasetKey, category: string): string {
    return `${dataset}::${(category ?? "").toString().toLowerCase()}`;
}

export async function ObjectsIn(
    dataset: DatasetKey,
    category: string
): Promise<QueryObject[]> {
    const key = objectsCacheKey(dataset, category);

    if (!objectsCache.has(key)) {
        objectsCache.set(
            key,
            (async () => {
                const response = await fetch(assetUrl(`${dataset}.geojson`));
                if (!response.ok) {
                    throw new Error(
                        `Failed to load dataset "${dataset}.geojson" (${response.status})`
                    );
                }
                const geojson = await response.json();

                const results: QueryObject[] = [];
                const normalizedCategory = (category ?? "").toString().toLowerCase();
                const returnAll = normalizedCategory === ALL_CATEGORY;

                for (const feature of geojson.features) {
                    const featureCategory =
                        (feature.properties.Categorie ?? "").toString().toLowerCase();

                    if (returnAll || featureCategory === normalizedCategory) {
                        const coords = parseCoordinates(feature.properties.Coordonnées);
                        results.push({
                            id: ObjectKeyfromProps(feature.properties.Nom, coords),
                            nom: feature.properties.Nom,
                            categorie: feature.properties.Categorie,
                            commune: feature.properties.Commune,
                            coordonnees: coords,
                            geometry: feature.geometry as GeoJSON.Point,
                        });
                    }
                }

                return results;
            })()
        );
    }

    return objectsCache.get(key)!;
}

export async function closestTo(
    pointWGS84: Point,
    commune: Commune,
    dataset: DatasetKey,
    category: string
): Promise<QueryObject[]> {
    const coordsKey = `${pointWGS84.latitude.toFixed(5)},${pointWGS84.longitude.toFixed(5)}`;
    const cacheKey = `${dataset}::${category.toLowerCase()}::${commune.name}::${coordsKey}`;

    if (closestCache.has(cacheKey)) {
        return closestCache.get(cacheKey)!;
    }

    const promise = (async () => {
        const allObjects: QueryObject[] = await ObjectsIn(dataset, category);
        // Deduplicate
        const deduped: QueryObject[] = [];
        const seen = new Set<string>();
        for (const obj of allObjects) {
            const key = ObjectKeyfromProps(obj.nom, obj.coordonnees);
            if (!seen.has(key)) {
                seen.add(key);
                deduped.push(obj);
            }
        }
        // Group by commune
        const byCommune = new Map<string, QueryObject[]>();
        for (const obj of deduped) {
            const list = byCommune.get(obj.commune) ?? [];
            list.push(obj);
            byCommune.set(obj.commune, list);
        }
        const MAX_CANDIDATES = 25;
        const MAX_OSRM_BATCH = 50; // Keep headroom for filtering

        type Candidate = { obj: QueryObject; approxKm: number };
        const candidates: Candidate[] = [];
        const visited = new Set<string>();

        const pushTier = (list: QueryObject[]) => {
            for (const obj of list) {
                const key = ObjectKeyfromProps(obj.nom, obj.coordonnees);
                if (visited.has(key)) continue;
                visited.add(key);
                const approxKm = haversineKm(pointWGS84, new Point(obj.coordonnees));
                candidates.push({ obj, approxKm });
            }
            candidates.sort((a, b) => a.approxKm - b.approxKm);
            if (candidates.length > MAX_OSRM_BATCH) {
                candidates.length = MAX_OSRM_BATCH;
            }
        };

        // Tier 1: same commune
        pushTier(byCommune.get(commune.name) ?? []);
        if (candidates.length < MAX_CANDIDATES) {
            // Tier 2: neighbours
            for (const neighbour of commune.neighbours) {
                pushTier(byCommune.get(neighbour) ?? []);
                if (candidates.length >= MAX_CANDIDATES) break;
            }
        }
        if (candidates.length < MAX_CANDIDATES) {
            // Tier 3: everything else, filtered by haversine
            const remaining = deduped.filter((obj) => !visited.has(ObjectKeyfromProps(obj.nom, obj.coordonnees)));
            pushTier(remaining);
        }

        const LIMIT = 10;
        const osrmTargets = candidates.slice(0, Math.min(MAX_OSRM_BATCH, Math.max(MAX_CANDIDATES, candidates.length)));

        const points = osrmTargets.map((c) => new Point(c.obj.coordonnees));
        const distances = await roadDistancesFrom(pointWGS84, points);

        const withDistances: Array<{ obj: QueryObject; distanceKm: number; approxKm: number }> = osrmTargets.map(
            (c, idx) => ({
                obj: c.obj,
                distanceKm: distances[idx]?.distanceKm ?? FALLBACK_DISTANCE_KM,
                approxKm: c.approxKm,
            })
        );

        const hasValid = withDistances.some(({ distanceKm }) => distanceKm < FALLBACK_DISTANCE_KM);

        withDistances.sort((a, b) => {
            const aInvalid = a.distanceKm >= FALLBACK_DISTANCE_KM;
            const bInvalid = b.distanceKm >= FALLBACK_DISTANCE_KM;

            if (hasValid) {
                if (aInvalid && !bInvalid) return 1;
                if (!aInvalid && bInvalid) return -1;
            }

            const distA = aInvalid ? a.approxKm : a.distanceKm;
            const distB = bInvalid ? b.approxKm : b.distanceKm;
            return distA - distB;
        });

        return withDistances.slice(0, LIMIT).map((x) => x.obj);
    })();

    promise.catch(() => {
        closestCache.delete(cacheKey);
    });

    closestCache.set(cacheKey, promise);
    return promise;
}
