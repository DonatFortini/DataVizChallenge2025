import { ObjectKeyfromProps, Point, type Commune, type Coordinates, type QueryObject } from "./types";
import { point as turfPoint } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { communes } from "./communes.data";
import type { DatasetKey } from "./datasets";
import { roadDistancesFrom, FALLBACK_DISTANCE_KM } from "./distance";

const BASE_URL = (import.meta as any).env?.BASE_URL ?? "/";

const geojsonCache = new Map<string, Promise<any>>();

export async function loadGeoJSON(path: string): Promise<any> {
    if (!geojsonCache.has(path)) {
        geojsonCache.set(
            path,
            fetch(`${BASE_URL}${path}`).then((response) => {
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
                const response = await fetch(`${BASE_URL}${dataset}.geojson`);
                if (!response.ok) {
                    throw new Error(
                        `Failed to load dataset "${dataset}.geojson" (${response.status})`
                    );
                }
                const geojson = await response.json();

                const results: QueryObject[] = [];
                const normalizedCategory = (category ?? "").toString().toLowerCase();
                const returnAll = normalizedCategory === "all";

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
        console.log(`Found ${allObjects.length} objects in dataset "${dataset}" with category "${category}"`);
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
        console.log(`Deduplicated to ${deduped.length} objects`);
        // Group by commune
        const byCommune = new Map<string, QueryObject[]>();
        for (const obj of deduped) {
            const list = byCommune.get(obj.commune) ?? [];
            list.push(obj);
            byCommune.set(obj.commune, list);
        }
        console.log(`Grouped objects by commune: ${byCommune.size} communes`);
        const CHUNK_SIZE = 35; // Match distance.ts TABLE_MAX_COORDS
        const visited = new Set<string>();
        const withDistances: Array<{ obj: QueryObject; distanceKm: number }> = [];

        const processBatch = async (batch: QueryObject[]) => {
            if (!batch.length) return;
            console.log(`Processing batch of ${batch.length} objects for distance calculation`);
            const points = batch.map((obj) => new Point(obj.coordonnees));
            const distances = await roadDistancesFrom(pointWGS84, points);
            for (let i = 0; i < batch.length; i++) {
                withDistances.push({
                    obj: batch[i],
                    distanceKm: distances[i] ?? FALLBACK_DISTANCE_KM,
                });
            }
        };

        const priority: QueryObject[] = [];
        const mark = (obj: QueryObject) => {
            const key = ObjectKeyfromProps(obj.nom, obj.coordonnees);
            if (!visited.has(key)) {
                visited.add(key);
                priority.push(obj);
            }
        };

        // Priority: Same commune + neighbors
        for (const obj of byCommune.get(commune.name) ?? []) mark(obj);
        for (const neighbour of commune.neighbours) {
            for (const obj of byCommune.get(neighbour) ?? []) mark(obj);
        }

        // Process priority tier (commune + neighbours)
        for (let start = 0; start < priority.length; start += CHUNK_SIZE) {
            await processBatch(priority.slice(start, start + CHUNK_SIZE));
        }

        // Process remaining objects
        const remaining = deduped.filter((obj) => {
            const key = ObjectKeyfromProps(obj.nom, obj.coordonnees);
            return !visited.has(key);
        });

        for (let start = 0; start < remaining.length; start += CHUNK_SIZE) {
            await processBatch(remaining.slice(start, start + CHUNK_SIZE));
        }

        // Sort by distance
        const hasValid = withDistances.some(({ distanceKm }) => distanceKm < FALLBACK_DISTANCE_KM);

        withDistances.sort((a, b) => {
            const aInvalid = a.distanceKm >= FALLBACK_DISTANCE_KM;
            const bInvalid = b.distanceKm >= FALLBACK_DISTANCE_KM;

            if (hasValid) {
                if (aInvalid && !bInvalid) return 1;
                if (!aInvalid && bInvalid) return -1;
            }

            return a.distanceKm - b.distanceKm;
        });

        const LIMIT = 10;
        return withDistances.slice(0, LIMIT).map((x) => x.obj);
    })();

    promise.catch(() => {
        closestCache.delete(cacheKey);
    });

    closestCache.set(cacheKey, promise);
    return promise;
}