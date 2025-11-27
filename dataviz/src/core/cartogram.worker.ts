/// <reference lib="webworker" />
import type * as GeoJSONType from 'geojson';
import { computeCartogram, type CartogramOptions, type IterationSnapshot } from './cartogram';

type CartogramWorkerRequest = {
    features: GeoJSONType.Feature<GeoJSONType.MultiPolygon>[];
    values: Record<string, number>;
    options?: CartogramOptions;
};

type CartogramWorkerResult = {
    warpedFeatures: GeoJSONType.Feature<GeoJSONType.MultiPolygon>[];
    meanError: number;
    iterationHistory: IterationSnapshot[];
};

type CartogramWorkerMessage = { ok: true; result: CartogramWorkerResult } | { ok: false; error?: string };

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<CartogramWorkerRequest>) => {
    try {
        const { features, values, options } = event.data;
        const result = computeCartogram(features, values, options);
        ctx.postMessage({ ok: true, result } as CartogramWorkerMessage);
    } catch (e: any) {
        ctx.postMessage({ ok: false, error: e?.message ?? 'Cartogram worker crashed' } as CartogramWorkerMessage);
    }
};

export {};
