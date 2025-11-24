import { Point } from './types';

const DEFAULT_OSRM_URL =
    (import.meta as any).env?.VITE_OSRM_URL ?? 'https://router.project-osrm.org';

const REQUEST_TIMEOUT_MS = 6000;
const FALLBACK_DISTANCE_KM = 1_000_000;
const MAX_CONCURRENT_REQUESTS = 4;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 300;

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
    const round = (v: number) => v.toFixed(5);
    return `${round(a.latitude)},${round(a.longitude)}->${round(
        b.latitude
    )},${round(b.longitude)}`;
}

function buildOsrmUrl(a: Point, b: Point): string {
    const baseUrl = DEFAULT_OSRM_URL.replace(/\/$/, '');
    return `${baseUrl}/route/v1/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=false&alternatives=false&steps=false&annotations=false`;
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
            const delay =
                RETRY_BASE_DELAY_MS * Math.pow(2, attempt) +
                Math.random() * 100;
            await sleep(delay);
        }
    }

    console.warn('OSRM fetch failed after retries:', lastError);
    return null;
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
