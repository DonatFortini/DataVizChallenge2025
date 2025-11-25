import { ObjectKeyfromProps, Point, type Commune, type QueryObject } from "./types";
import { point as turfPoint } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { communes } from "./communes.data";
import type { DatasetKey } from "./datasets";
import { roadDistanceBetween } from "./distance";

const BASE_URL = (import.meta as any).env?.BASE_URL ?? "/";



const geojsonCache = new Map<string, Promise<any>>();

export async function loadGeoJSON(path: string): Promise<any> {
    if (!geojsonCache.has(path)) {
        geojsonCache.set(
            path,
            fetch(`${BASE_URL}/${path}`).then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load GeoJSON "${path}" (${response.status})`);
                }
                return response.json();
            })
        );
    }
    return geojsonCache.get(path)!;
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
            const neighbours = neighbouringCommunes(communeName);
            return {
                name: communeName,
                neighbours,
                polygon: feature.geometry,
            };
        }
    }

    throw new Error("No commune found for the given point");
}


const objectsCache = new Map<string, Promise<QueryObject[]>>();

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
                const response = await fetch(`${BASE_URL}/${dataset}.geojson`);
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
                        (feature.properties.categorie ?? "").toString().toLowerCase();

                    if (returnAll || featureCategory === normalizedCategory) {
                        results.push({
                            id: ObjectKeyfromProps(feature.properties.nom, feature.properties.coordonnees),
                            nom: feature.properties.nom,
                            categorie: feature.properties.categorie,
                            commune: feature.properties.commune,
                            coordonnees: feature.properties.coordonnees, // WGS84
                            geometry: feature.geometry, // Lambert
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
    const allObjects: QueryObject[] = await ObjectsIn(dataset, category);

    const byCommune = new Map<string, QueryObject[]>();
    for (const obj of allObjects) {
        const list = byCommune.get(obj.commune) ?? [];
        list.push(obj);
        byCommune.set(obj.commune, list);
    }

    const candidateMap = new Map<string, QueryObject>();

    const addCandidate = (obj: QueryObject) => {
        if (!candidateMap.has(obj.nom)) {
            candidateMap.set(obj.nom, obj);
        }
    };

    for (const obj of byCommune.get(commune.name) ?? []) {
        addCandidate(obj);
    }

    for (const neighbourName of commune.neighbours) {
        for (const obj of byCommune.get(neighbourName) ?? []) {
            addCandidate(obj);
        }
    }

    const MIN_CANDIDATES = 10;
    const MAX_CANDIDATES = 50;

    if (candidateMap.size < MIN_CANDIDATES) {
        for (const obj of allObjects) {
            addCandidate(obj);
            if (candidateMap.size >= MAX_CANDIDATES) break;
        }
    }

    const candidates = Array.from(candidateMap.values());

    const withDistances = await Promise.all(
        candidates.map(async (obj) => {
            const coord = obj.coordonnees as unknown as [number, number];
            const targetPoint = new Point(coord);
            const { distanceKm } = await roadDistanceBetween(pointWGS84, targetPoint);
            return { obj, distanceKm };
        })
    );

    withDistances.sort((a, b) => a.distanceKm - b.distanceKm);

    const LIMIT = 10;
    return withDistances.slice(0, LIMIT).map((x) => x.obj);
}
