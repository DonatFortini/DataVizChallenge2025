import type * as GeoJSON from 'geojson';

// Canonical runtime shape for all features
type BaseFeature<P, G extends GeoJSON.Geometry> = {
    properties: P;
    geometry: G;
    // normalized coordinates (center or point) to avoid re-computing
    coordinates: Cooridinates;
};

type Commune = BaseFeature<{ nom: string }, GeoJSON.MultiPolygon>;
type SportObject = BaseFeature<{ nom: string; profession: string }, GeoJSON.MultiPolygon>;

interface CommonPointProps {
    nom: string;
    profession: string;
    adresse: string;
    commune: string;
}

type EduObject = BaseFeature<CommonPointProps, GeoJSON.Point>;
type MedicalObject = BaseFeature<CommonPointProps, GeoJSON.Point>;

type GeojsonFeature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
type GeojsonFetchResponse = Commune | SportObject | EduObject | MedicalObject;

class Cooridinates {
    latitude: number;  // degrees
    longitude: number; // degrees

    private static readonly DEG_TO_RAD = Math.PI / 180;
    private static readonly RAD_TO_DEG = 180 / Math.PI;
    private static readonly LAMBERT = {
        // Projection Lambert-93 constants (EPSG:2154)
        n: 0.7256077650532670,
        c: 11754255.426096,
        xs: 700000.0,
        ys: 12655612.049876, // corrected offset to avoid Y underflow
        lambda0: 3 * (Math.PI / 180), // 3° in radians
        e: 0.08181919104281579 // eccentricity (GRS80)
    };

    constructor(latitude: number, longitude: number) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public toLambert(): { x: number; y: number } {
        const { n, c, xs, ys, lambda0, e } = Cooridinates.LAMBERT;
        const lat = this.latitude * Cooridinates.DEG_TO_RAD;
        const lon = this.longitude * Cooridinates.DEG_TO_RAD;

        const sinLat = Math.sin(lat);
        const t = Math.tan(Math.PI / 4 + lat / 2) *
            Math.pow((1 - e * sinLat) / (1 + e * sinLat), e / 2);
        const s = Math.log(t);
        const r = c * Math.exp(-n * s);
        const theta = n * (lon - lambda0);

        const x = xs + r * Math.sin(theta);
        const y = ys - r * Math.cos(theta);

        return { x, y };
    }

    public static fromLambert(x: number, y: number): Cooridinates {
        const { n, c, xs, ys, lambda0, e } = Cooridinates.LAMBERT;
        const dx = x - xs;
        const dy = ys - y;
        const r = Math.sign(n) * Math.sqrt(dx * dx + dy * dy);
        const theta = Math.atan2(dx, dy);
        const lon = lambda0 + theta / n;

        const s = -1 / n * Math.log(Math.abs(r / c));
        // initial latitude estimate (sphere)
        let lat = 2 * Math.atan(Math.exp(s)) - Math.PI / 2;

        // iterate to correct for ellipsoid (converges quickly)
        for (let i = 0; i < 10; i++) {
            const sinLat = Math.sin(lat);
            const prev = lat;
            lat = 2 * Math.atan(
                Math.pow((1 + e * sinLat) / (1 - e * sinLat), e / 2) * Math.exp(s)
            ) - Math.PI / 2;
            if (Math.abs(lat - prev) < 1e-12) break;
        }

        return new Cooridinates(lat * Cooridinates.RAD_TO_DEG, lon * Cooridinates.RAD_TO_DEG);
    }

    public toGPS(): { latitude: number; longitude: number } {
        return { latitude: this.latitude, longitude: this.longitude };
    }
}

export { Cooridinates };
export type {
    GeojsonFeature,
    GeojsonFetchResponse,
    Commune,
    SportObject,
    CommonPointProps,
    EduObject,
    MedicalObject
};
