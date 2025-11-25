import { Point } from './types';

const DEFAULT_OSRM_URL =
    (import.meta as any).env?.VITE_OSRM_URL ?? 'https://router.project-osrm.org';

const REQUEST_TIMEOUT_MS = 10000; // Increased to 10s
const MAX_CONCURRENT_REQUESTS = 1; // CRITICAL: Only 1 concurrent request for public OSRM TODO : test that
const TABLE_MAX_COORDS = 35; // Reduced to 20 to avoid URL length issues
const MAX_RETRIES = 3; // Increased retries
const RETRY_BASE_DELAY_MS = 1000; // Longer delays between retries
export const FALLBACK_DISTANCE_KM = 1_000_000;

export type DistanceMode = 'car';

export type DistanceResult = {
    distanceKm: number;
    mode: DistanceMode;
};

const roadDistanceCache = new Map<string, number>();
const inFlightRequests = new Map<string, Promise<number | null>>();

let activeCount = 0;
const queue: Array<() => void> = [];

function schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const run = () => {
            activeCount++;
            task()
                .then(resolve, reject)
                .finally(() => {
                    activeCount--;
                    const next = queue.shift();
                    if (next) next();
                });
        };

        if (activeCount < MAX_CONCURRENT_REQUESTS) {
            run();
        } else {
            queue.push(run);
        }
    });
}

function buildCacheKey(a: Point, b: Point): string {
    const round = (v: number): string => Number(v).toFixed(5);
    return `${round(a.latitude)},${round(a.longitude)}->${round(
        b.latitude
    )},${round(b.longitude)}`;
}

function buildOsrmUrl(a: Point, b: Point): string {
    const baseUrl = DEFAULT_OSRM_URL.replace(/\/$/, '');
    return `${baseUrl}/route/v1/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=false&alternatives=false&steps=false&annotations=false`;
}

function buildTableUrl(origin: Point, targets: Point[]): string {
    const baseUrl = DEFAULT_OSRM_URL.replace(/\/$/, '');
    const coords = [origin, ...targets]
        .map((p) => `${p.longitude},${p.latitude}`)
        .join(';');
    const destinations = targets.map((_, i) => i + 1).join(';');
    return `${baseUrl}/table/v1/driving/${coords}?annotations=distance&sources=0&destinations=${destinations}`;
}

function sleep(ms: number) {
    return new Promise<void>((res) => setTimeout(res, ms));
}

async function fetchRoadDistanceKmRaw(url: string): Promise<number | null> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller =
            typeof AbortController !== 'undefined' ? new AbortController() : undefined;
        const timeout = controller
            ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
            : null;

        try {
            const resp = await fetch(url, { signal: controller?.signal });

            if (!resp.ok) {
                if (resp.status >= 500 || resp.status === 429) {
                    lastError = new Error(`HTTP ${resp.status}`);
                } else {
                    return null;
                }
            } else {
                const data = await resp.json();
                const meters = data?.routes?.[0]?.distance;
                if (typeof meters !== 'number' || !Number.isFinite(meters)) {
                    return null;
                }
                return meters / 1000;
            }
        } catch (err) {
            lastError = err;
        } finally {
            if (timeout) clearTimeout(timeout);
        }

        if (attempt < MAX_RETRIES) {
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
            await sleep(delay);
        }
    }

    console.warn('OSRM fetch failed after retries:', lastError);
    return null;
}

async function fetchCarDistancesKmTable(
    origin: Point,
    targets: Point[]
): Promise<(number | null)[]> {
    if (!targets.length) return [];

    const url = buildTableUrl(origin, targets);
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller =
            typeof AbortController !== 'undefined' ? new AbortController() : undefined;
        const timeout = controller
            ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
            : null;

        try {
            const resp = await fetch(url, { signal: controller?.signal });

            if (!resp.ok) {
                if (resp.status >= 500 || resp.status === 429) {
                    lastError = new Error(`HTTP ${resp.status}`);
                } else {
                    return targets.map(() => null);
                }
            } else {
                const data = await resp.json();
                const table = data?.distances?.[0];

                if (!Array.isArray(table)) {
                    return targets.map(() => null);
                }

                const distances: (number | null)[] = [];
                for (let i = 0; i < targets.length; i++) {
                    const entry = table[i];
                    distances.push(
                        typeof entry === 'number' && Number.isFinite(entry) ? entry / 1000 : null
                    );
                }

                return distances;
            }
        } catch (err) {
            lastError = err;
        } finally {
            if (timeout) clearTimeout(timeout);
        }

        if (attempt < MAX_RETRIES) {
            // Exponential backoff with longer delays
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
            await sleep(delay);
        }
    }

    console.warn('OSRM table fetch failed after retries:', lastError);
    return targets.map(() => null);
}

async function fetchCarDistanceKm(a: Point, b: Point): Promise<number | null> {
    const key = buildCacheKey(a, b);

    if (roadDistanceCache.has(key)) {
        return roadDistanceCache.get(key)!;
    }

    if (inFlightRequests.has(key)) {
        return inFlightRequests.get(key)!;
    }

    const url = buildOsrmUrl(a, b);

    const promise = schedule<number | null>(async () => {
        try {
            const km = await fetchRoadDistanceKmRaw(url);
            if (km != null) {
                roadDistanceCache.set(key, km);
            }
            return km;
        } finally {
            inFlightRequests.delete(key);
        }
    });

    inFlightRequests.set(key, promise);

    return promise;
}

export async function roadDistanceBetween(
    a: Point,
    b: Point
): Promise<DistanceResult> {
    const carKm = await fetchCarDistanceKm(a, b);
    return {
        distanceKm: carKm ?? FALLBACK_DISTANCE_KM,
        mode: 'car',
    };
}

export async function roadDistancesFrom(
    origin: Point,
    targets: Point[]
): Promise<number[]> {
    if (!targets.length) return [];

    const results = new Array<number>(targets.length).fill(FALLBACK_DISTANCE_KM);
    const missingIndices: number[] = [];
    const missingPoints: Point[] = [];

    // Check cache first
    targets.forEach((target, idx) => {
        const key = buildCacheKey(origin, target);
        if (roadDistanceCache.has(key)) {
            results[idx] = roadDistanceCache.get(key)!;
        } else {
            missingIndices.push(idx);
            missingPoints.push(target);
        }
    });

    if (missingPoints.length) {
        // Batch in smaller chunks with delay between batches
        for (let start = 0; start < missingPoints.length; start += TABLE_MAX_COORDS) {
            const slice = missingPoints.slice(start, start + TABLE_MAX_COORDS);
            const sliceIndices = missingIndices.slice(start, start + TABLE_MAX_COORDS);

            // Add delay between batches to avoid rate limiting
            if (start > 0) {
                await sleep(500); // 500ms delay between batches
            }

            const sliceDistances = await schedule(() => fetchCarDistancesKmTable(origin, slice));

            sliceDistances.forEach((km, i) => {
                const targetIdx = sliceIndices[i];
                if (km != null) {
                    results[targetIdx] = km;
                    roadDistanceCache.set(buildCacheKey(origin, targets[targetIdx]), km);
                }
            });
        }
    }

    return results;
}

export function clearDistanceCache(): void {
    roadDistanceCache.clear();
}

export function getCacheSize(): number {
    return roadDistanceCache.size;
}

export function getCacheStats(): { size: number; inFlight: number; activeRequests: number } {
    return {
        size: roadDistanceCache.size,
        inFlight: inFlightRequests.size,
        activeRequests: activeCount
    };
}