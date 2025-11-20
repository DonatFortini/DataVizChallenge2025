import type * as GeoJSON from 'geojson';
import { type GeojsonFetchResponse, Cooridinates, type Commune, type GeojsonFeature, type FeatureWithCoordinates, type NormalizedProperties } from './types';
const geojsonCache = new Map<string, any>();

const BASE_URL = (import.meta as any).env?.BASE_URL ?? '/';

async function fetchRawGeojson(fileName: string): Promise<any> {
    if (geojsonCache.has(fileName)) return geojsonCache.get(fileName);
    const url = `${BASE_URL.replace(/\/?$/, '/')}${fileName}.geojson`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${fileName}.geojson`);
    const text = await resp.text();
    const safe = text.replace(/\bNaN\b/g, 'null');
    const json = JSON.parse(safe);
    geojsonCache.set(fileName, json);
    return json;
}

function normalizeToCoordinates(geometry: GeoJSON.Geometry): Cooridinates {
    if (!geometry) return new Cooridinates(0, 0);
    if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
        const [lon, lat] = geometry.coordinates as number[];
        return new Cooridinates(lat ?? 0, lon ?? 0);
    }
    if (geometry.type === 'MultiPolygon' || geometry.type === 'Polygon') {
        return getMultipolygonCenter({ geometry } as Commune);
    }
    return new Cooridinates(0, 0);
}

async function fetchGeojsonData(fileName: string): Promise<GeojsonFetchResponse[]> {
    const data = await fetchRawGeojson(fileName);
    const features: GeojsonFeature[] = data?.features ?? [];
    const isLambert93 = typeof data?.crs?.properties?.name === 'string' && data.crs.properties.name.includes('2154');
    const looksLambert = features.length > 0 && geometryLooksLambert(features[0].geometry);
    const useLambert = isLambert93 || looksLambert;
    return features.map(f => {
        const geometry = useLambert ? convertGeometryToWGS(f.geometry) : f.geometry;
        const coords = normalizeToCoordinates(geometry);
        return {
            properties: normalizeProperties(f.properties),
            geometry,
            coordinates: coords,
        } as FeatureWithCoordinates;
    });
}

function normalizeProperties(props: Record<string, unknown> | undefined): NormalizedProperties {
    const nom = pickStringValue(props, ['Nom', 'nom', 'nom_commune', 'name']);
    const categorie = pickStringValue(props, ['Categorie', 'categorie', 'profession']);
    const commune = pickStringValue(props, ['Commune', 'commune', 'nom_commune']);
    const coordonnees = pickStringValue(props, ['Coordonnees', 'Coordonnées', 'coordonnees']);

    return {
        ...(props ?? {}),
        nom: nom ?? undefined,
        categorie: categorie ?? undefined,
        commune: commune ?? undefined,
        coordonnees: coordonnees ?? undefined
    };
}

function pickStringValue(props: Record<string, unknown> | undefined, keys: string[]): string | undefined {
    if (!props) return undefined;
    for (const key of keys) {
        const val = props[key];
        if (typeof val === 'string' && val.trim().length > 0) {
            return val;
        }
    }
    return undefined;
}

export async function isInCorsica(point: Cooridinates): Promise<boolean> {
    try {
        const corse = await fetchRawGeojson('corse');
        const isLambert93 = typeof corse?.crs?.properties?.name === 'string' && corse.crs.properties.name.includes('2154');
        const rawGeom = corse?.features?.[0]?.geometry;
        const looksLambert = geometryLooksLambert(rawGeom);
        const useLambert = isLambert93 || looksLambert;
        const geom = useLambert ? rawGeom : convertGeometryToWGS(rawGeom);
        const testPoint = useLambert ? lambertPointFromGPS(point) : point;
        return !!geom && isPointInGeometry(testPoint, geom);
    } catch {
        return false;
    }
}


async function closestTo(base: Cooridinates, dataset: string): Promise<GeojsonFetchResponse[]> {
    if (!(await isInCorsica(base))) return [];

    const data = await fetchGeojsonData(dataset);

    return data
        .map(d => {
            return { commune: d, dist: haversineDistance(base, d.coordinates) };
        })
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 10)
        .map(item => item.commune);
}

function isPointInGeometry(point: Cooridinates, geometry: any): boolean {
    if (!geometry) return false;
    const { type, coordinates } = geometry;
    if (!coordinates) return false;

    if (type === 'Polygon') return pointInPolygon(point, coordinates);
    if (type === 'MultiPolygon') return coordinates.some((poly: any) => pointInPolygon(point, poly));
    return false;
}

function pointInPolygon(point: Cooridinates, polygonCoords: number[][][]): boolean {
    const outer = polygonCoords?.[0];
    if (!outer) return false;
    if (!pointInRing(point, outer)) return false;
    for (let i = 1; i < polygonCoords.length; i++) {
        if (pointInRing(point, polygonCoords[i])) return false;
    }
    return true;
}

function pointInRing(point: Cooridinates, ring: number[][]): boolean {
    const x = point.longitude;
    const y = point.latitude;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersects = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / ((yj - yi) || Number.EPSILON) + xi);
        if (intersects) inside = !inside;
    }
    return inside;
}

function haversineDistance(a: Cooridinates, b: Cooridinates): number {
    const R = 6371;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const aVal = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return R * (2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal)));
}

function toRad(value: number): number {
    return (value * Math.PI) / 180;
}

async function communeContainingPoint(point: Cooridinates): Promise<GeojsonFetchResponse | undefined> {
    const communes = await fetchGeojsonData('communes');
    return communes.find(commune => isPointInGeometry(point, (commune as any).geometry));
}

export async function closestCommune(base: Cooridinates): Promise<GeojsonFetchResponse> {
    const containing = await communeContainingPoint(base);
    if (containing) return containing;
    return (await closestTo(base, 'communes'))[0];
}

function getMultipolygonCenter(commune: Commune): Cooridinates {
    const geom: any = (commune as any).geometrie ?? (commune as any).geometry;
    if (!geom) {
        const g = (commune as any).geometrie;
        if (g instanceof Cooridinates) return g;
        return new Cooridinates(0, 0);
    }


    function ringAreaAndCentroid(ring: number[][]) {
        let A = 0;
        let Cx = 0;
        let Cy = 0;
        const n = ring.length;
        if (n === 0) return { area: 0, cx: 0, cy: 0 };
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = ring[i][0], yi = ring[i][1];
            const xj = ring[j][0], yj = ring[j][1];
            const cross = xi * yj - xj * yi;
            A += cross;
            Cx += (xi + xj) * cross;
            Cy += (yi + yj) * cross;
        }
        A = A / 2;
        if (Math.abs(A) < Number.EPSILON) {
            const avgX = ring.reduce((s, p) => s + p[0], 0) / n;
            const avgY = ring.reduce((s, p) => s + p[1], 0) / n;
            return { area: 0, cx: avgX, cy: avgY };
        }
        return { area: A, cx: Cx / (6 * A), cy: Cy / (6 * A) };
    }

    function polygonAreaAndCentroid(polygon: number[][][]) {
        let totalA = 0;
        let weightedCx = 0;
        let weightedCy = 0;
        for (let r = 0; r < polygon.length; r++) {
            const ring = polygon[r];
            const { area, cx, cy } = ringAreaAndCentroid(ring);
            totalA += area;
            weightedCx += cx * area;
            weightedCy += cy * area;
        }
        if (Math.abs(totalA) < Number.EPSILON) {
            const outer = polygon[0] ?? [];
            const n = outer.length || 1;
            const avgX = outer.reduce((s, p) => s + p[0], 0) / n;
            const avgY = outer.reduce((s, p) => s + p[1], 0) / n;
            return { area: 0, cx: avgX, cy: avgY };
        }
        return { area: totalA, cx: weightedCx / totalA, cy: weightedCy / totalA };
    }

    let totalArea = 0;
    let totalCx = 0;
    let totalCy = 0;

    if (geom.type === 'Polygon') {
        const { area, cx, cy } = polygonAreaAndCentroid(geom.coordinates);
        totalArea = area;
        totalCx = cx;
        totalCy = cy;
    } else if (geom.type === 'MultiPolygon') {
        for (const polygon of geom.coordinates) {
            const { area, cx, cy } = polygonAreaAndCentroid(polygon);
            totalArea += area;
            totalCx += cx * area;
            totalCy += cy * area;
        }
        if (Math.abs(totalArea) > Number.EPSILON) {
            totalCx = totalCx / totalArea;
            totalCy = totalCy / totalArea;
        } else {
            const first = geom.coordinates?.[0]?.[0] ?? [[0, 0]];
            const avgX = first.reduce((s: number, p: number[]) => s + p[0], 0) / first.length;
            const avgY = first.reduce((s: number, p: number[]) => s + p[1], 0) / first.length;
            totalCx = avgX;
            totalCy = avgY;
        }
    } else {
        if (Array.isArray((commune as any).geometrie) && (commune as any).geometrie.length === 2) {
            return new Cooridinates((commune as any).geometrie[1], (commune as any).geometrie[0]);
        }
        if ((commune as any).geometrie instanceof Cooridinates) return (commune as any).geometrie;
        return new Cooridinates(0, 0);
    }

    return new Cooridinates(totalCy, totalCx);
}

function convertGeometryToWGS(geometry: GeoJSON.Geometry): GeoJSON.Geometry {
    if (!geometry) return geometry;
    if (geometry.type === 'Point') {
        const [x, y] = geometry.coordinates as number[];
        const gps = Cooridinates.fromLambert(x, y);
        return { type: 'Point', coordinates: [gps.longitude, gps.latitude] };
    }
    if (geometry.type === 'Polygon') {
        const coords = geometry.coordinates.map(ring =>
            ring.map(([x, y]) => {
                const gps = Cooridinates.fromLambert(x, y);
                return [gps.longitude, gps.latitude];
            })
        );
        return { type: 'Polygon', coordinates: coords };
    }
    if (geometry.type === 'MultiPolygon') {
        const coords = geometry.coordinates.map(poly =>
            poly.map(ring =>
                ring.map(([x, y]) => {
                    const gps = Cooridinates.fromLambert(x, y);
                    return [gps.longitude, gps.latitude];
                })
            )
        );
        return { type: 'MultiPolygon', coordinates: coords };
    }
    return geometry;
}

function geometryLooksLambert(geometry: GeoJSON.Geometry | null | undefined): boolean {
    if (!geometry) return false;
    if (!('coordinates' in geometry)) return false;
    const value = extractFirstNumber((geometry as any).coordinates);
    if (value === null) return false;
    return Math.abs(value) > 400;
}

function extractFirstNumber(input: any): number | null {
    if (Array.isArray(input)) {
        for (const v of input) {
            const res = extractFirstNumber(v);
            if (res !== null) return res;
        }
        return null;
    }
    return typeof input === 'number' ? input : null;
}

function lambertPointFromGPS(point: Cooridinates): Cooridinates {
    const { x, y } = point.toLambert();
    return new Cooridinates(y, x);
}

export function featureKey(feature: GeojsonFetchResponse): string {
    const nom = (feature as any).properties?.nom ?? (feature as any).properties?.Nom ?? 'item';
    const { latitude, longitude } = feature.coordinates;
    return `${nom}:${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}


type IsochroneOptions = { paddingKm?: number };

export function computeIsochrone(base: Cooridinates, targets: Cooridinates[], opts: IsochroneOptions = {}): GeoJSON.Polygon {
    const points = [base, ...targets];
    const padding = opts.paddingKm ?? 1;

    if (points.length < 3) {
        const maxDist = Math.max(...targets.map(t => haversineDistance(base, t)), padding);
        return circlePolygon(base, maxDist + padding);
    }

    const hull = convexHull(points.map(p => ({ x: p.longitude, y: p.latitude })));
    const ring = hull.map(p => [p.x, p.y]);
    if (ring.length === 0) return circlePolygon(base, padding);
    ring.push(ring[0]);
    return { type: 'Polygon', coordinates: [ring] };
}

function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
    if (points.length <= 1) return points;
    const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

    const cross = (o: any, a: any, b: any) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower: any[] = [];
    for (const p of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }
    const upper: any[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        const p = sorted[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
}

function circlePolygon(center: Cooridinates, radiusKm: number): GeoJSON.Polygon {
    const steps = 64;
    const coords: number[][] = [];
    const latRad = toRad(center.latitude);
    const lonRad = toRad(center.longitude);
    const angDist = radiusKm / 6371;
    for (let i = 0; i <= steps; i++) {
        const theta = 2 * Math.PI * (i / steps);
        const lat = Math.asin(Math.sin(latRad) * Math.cos(angDist) + Math.cos(latRad) * Math.sin(angDist) * Math.cos(theta));
        const lon = lonRad + Math.atan2(Math.sin(theta) * Math.sin(angDist) * Math.cos(latRad), Math.cos(angDist) - Math.sin(latRad) * Math.sin(lat));
        coords.push([lon * 180 / Math.PI, lat * 180 / Math.PI]);
    }
    return { type: 'Polygon', coordinates: [coords] };
}

type ClosestResult = { items: GeojsonFetchResponse[]; categories: string[] };

export async function closestObjectsToBase(base: Cooridinates, object_type: 'sport' | 'etude' | 'sante', categoryFilter?: string): Promise<ClosestResult> {
    const dataset = object_type === 'sport' ? 'sport' : object_type === 'etude' ? 'etude' : 'sante';

    const startCommune = await closestCommune(base) as Commune;
    if (!startCommune) return { items: [], categories: [] };

    const allObjects = await fetchGeojsonData(dataset);
    const categories = Array.from(new Set(
        allObjects
            .map(o => (o.properties?.categorie ?? '') as string)
            .filter(c => typeof c === 'string' && c.trim().length > 0)
            .map(c => c.trim())
    )).sort((a, b) => a.localeCompare(b));

    const normalizedFilter = categoryFilter?.toLowerCase().trim();
    const filteredObjects = normalizedFilter
        ? allObjects.filter(o => (o.properties?.categorie ?? '').toString().toLowerCase().trim() === normalizedFilter)
        : allObjects;

    const deduped: GeojsonFetchResponse[] = [];
    const seenKeys = new Set<string>();
    for (const obj of filteredObjects) {
        const key = featureKey(obj);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        deduped.push(obj);
    }

    if (deduped.length === 0) {
        return { items: [], categories };
    }

    // Sort globally by distance to the selected base and keep up to 10.
    const sorted = [...deduped]
        .map(o => ({ o, dist: haversineDistance(base, o.coordinates) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 10)
        .map(({ o }) => o);

    return { items: sorted, categories };
}
