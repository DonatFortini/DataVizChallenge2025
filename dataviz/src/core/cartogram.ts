import type * as GeoJSONType from 'geojson';
import { toLambert, toWGS } from './types';

type XY = [number, number];
type MultiPolygonXY = XY[][][];

type CartogramOptions = {
    iterations?: number;
    backgroundValue?: number;
};

type PolygonStats = {
    area: number;
    centroid: XY;
};

type IterationSnapshot = {
    stats: Array<{ centroid: XY; radius: number; mass: number }>;
    forceReduction: number;
};

const SAFE_MIN = 1e-6;

const toLambertMultiPolygon = (geom: GeoJSONType.MultiPolygon): MultiPolygonXY =>
    geom.coordinates.map(poly =>
        poly.map(ring =>
            ring.map(([lon, lat]) => {
                const [x, y] = toLambert([lat, lon]);
                return [x, y];
            })
        )
    );

const toWGSMultiPolygon = (geom: MultiPolygonXY): GeoJSONType.MultiPolygon =>
    ({
        type: 'MultiPolygon',
        coordinates: geom.map(poly =>
            poly.map(ring =>
                ring.map(([x, y]) => {
                    const [lat, lon] = toWGS([x, y]);
                    return [lon, lat];
                })
            )
        )
    });

function areaAndCentroid(geom: MultiPolygonXY): PolygonStats {
    let areaSum = 0;
    let cxSum = 0;
    let cySum = 0;

    for (const poly of geom) {
        for (const ring of poly) {
            const n = ring.length;
            if (n < 3) continue;
            for (let i = 0; i < n; i++) {
                const [x0, y0] = ring[i];
                const [x1, y1] = ring[(i + 1) % n];
                const cross = x0 * y1 - x1 * y0;
                areaSum += cross;
                cxSum += (x0 + x1) * cross;
                cySum += (y0 + y1) * cross;
            }
        }
    }

    const signedArea = areaSum / 2;
    const area = Math.abs(signedArea);
    if (area < SAFE_MIN) {
        const first = geom[0]?.[0]?.[0];
        return { area: SAFE_MIN, centroid: first ?? [0, 0] };
    }

    const cx = cxSum / (6 * signedArea);
    const cy = cySum / (6 * signedArea);
    return { area, centroid: [cx, cy] };
}

/**
 * Implementation of the Dougenik et al. continuous cartogram algorithm.
 * We use travel-time-derived values for each polygon as weights and iterate
 * a small, fixed number of times to reduce size error while keeping topology.
 */
export function buildCartogram(
    features: GeoJSONType.Feature<GeoJSONType.MultiPolygon>[],
    values: Record<string, number>,
    options?: CartogramOptions
): { warpedFeatures: GeoJSONType.Feature<GeoJSONType.MultiPolygon>[]; meanError: number } {
    const iterations = options?.iterations ?? 8;
    const backgroundValue = Math.max(options?.backgroundValue ?? 1, SAFE_MIN);

    const regions = features.map(feature => {
        const geom = feature.geometry;
        if (!geom || geom.type !== 'MultiPolygon') return null;
        const name = (feature.properties as any)?.nom ?? 'Commune';
        const value = Math.max(values[name] ?? backgroundValue, SAFE_MIN);
        return {
            feature,
            name,
            value,
            coords: toLambertMultiPolygon(geom)
        };
    }).filter((r): r is NonNullable<typeof r> => Boolean(r));

    const totalValue = regions.reduce((sum, r) => sum + r.value, 0) || SAFE_MIN;
    const baseAreas = regions.map(r => areaAndCentroid(r.coords).area);
    const targetTotalArea = baseAreas.reduce((a, b) => a + b, 0) || SAFE_MIN;

    let working = regions.map(r => r.coords.map(poly => poly.map(ring => ring.map(([x, y]) => [x, y] as XY))));
    let meanError = 1;
    const iterationHistory: IterationSnapshot[] = [];

    for (let iter = 0; iter < iterations; iter++) {
        const stats = working.map((geom, idx) => {
            const { area, centroid } = areaAndCentroid(geom);
            const desiredArea = targetTotalArea * (regions[idx].value / totalValue);
            const radius = Math.sqrt(Math.max(area, SAFE_MIN) / Math.PI);
            const desiredRadius = Math.sqrt(Math.max(desiredArea, SAFE_MIN) / Math.PI);
            const mass = desiredRadius - radius;
            const sizeError = Math.max(area, desiredArea) / Math.max(Math.min(area, desiredArea), SAFE_MIN);
            return { centroid, radius: Math.max(radius, SAFE_MIN), mass, sizeError };
        });

        meanError = stats.reduce((sum, s) => sum + s.sizeError, 0) / Math.max(stats.length, 1);
        const forceReduction = 1 / (1 + meanError);
        iterationHistory.push({
            stats: stats.map(s => ({ centroid: s.centroid, radius: s.radius, mass: s.mass })),
            forceReduction
        });

        const next = working.map(polyset =>
            polyset.map(rings =>
                rings.map(ring =>
                    ring.map(([x, y]) => {
                        let moveX = 0;
                        let moveY = 0;
                        for (const stat of stats) {
                            const dx = x - stat.centroid[0];
                            const dy = y - stat.centroid[1];
                            const dist = Math.hypot(dx, dy) || SAFE_MIN;
                            const dirX = dx / dist;
                            const dirY = dy / dist;
                            const r = stat.radius;
                            const dOverR = dist / r;
                            const force = dist > r
                                ? stat.mass * (r / dist)
                                : stat.mass * (dOverR * dOverR) * (4 - 3 * dOverR);
                            moveX += force * dirX;
                            moveY += force * dirY;
                        }
                        return [x + moveX * forceReduction, y + moveY * forceReduction] as XY;
                    })
                )
            )
        );

        working = next;
        if (meanError <= 1.01) break;
    }

    const warpedFeatures = regions.map((region, idx) => ({
        ...region.feature,
        geometry: toWGSMultiPolygon(working[idx])
    }));

    const warpPoint = (coords: [number, number]): [number, number] => {
        let [px, py] = toLambert(coords);
        for (const iter of iterationHistory) {
            let moveX = 0;
            let moveY = 0;
            for (const stat of iter.stats) {
                const dx = px - stat.centroid[0];
                const dy = py - stat.centroid[1];
                const dist = Math.hypot(dx, dy) || SAFE_MIN;
                const dirX = dx / dist;
                const dirY = dy / dist;
                const dOverR = dist / stat.radius;
                const force = dist > stat.radius
                    ? stat.mass * (stat.radius / dist)
                    : stat.mass * (dOverR * dOverR) * (4 - 3 * dOverR);
                moveX += force * dirX;
                moveY += force * dirY;
            }
            px += moveX * iter.forceReduction;
            py += moveY * iter.forceReduction;
        }
        const [lat, lon] = toWGS([px, py]);
        return [lat, lon];
    };

    return { warpedFeatures, meanError, warpPoint };
}
