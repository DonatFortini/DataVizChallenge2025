import type {
    Feature,
    FeatureCollection,
    Polygon,
    MultiPolygon,
    Position,
} from "geojson";
import { Point } from "./types";
import { roadDistanceBetween } from "./distance";
import { loadGeoJSON } from "./engine";


export type CommuneFeature = Feature<Polygon | MultiPolygon, { [key: string]: any }>;


async function computeScaleFactorForCommune(
    basePoint: Point,        // WGS84
    communeFeature: CommuneFeature
): Promise<{
    factor: number;
    carDistanceKm: number;
}> {
    const coordWGS = communeFeature.properties.coordonnees as
        | [number, number]
        | undefined;

    if (!coordWGS) {
        throw new Error(
            `Commune feature is missing "properties.coordonnees" (needed for OSRM distance).`
        );
    }

    const communePoint = new Point(coordWGS); // WGS84

    const { distanceKm: carDistanceKm } = await roadDistanceBetween(
        basePoint,
        communePoint
    );

    const [bx, by] = basePoint.toLambert() as [number, number];      // en mètres
    const [cx, cy] = communePoint.toLambert() as [number, number];   // en mètres

    const dx = cx - bx;
    const dy = cy - by;
    const geoDistM = Math.sqrt(dx * dx + dy * dy);
    const geoDistKm = geoDistM / 1000;

    const safeGeoDistKm = geoDistKm || 1e-6;

    // Facteur radial : on veut que la distance en Lambert reflète la distance voiture
    // factor = carDistanceKm / geoDistKm
    const factor = carDistanceKm / safeGeoDistKm;

    return { factor, carDistanceKm };
}


function warpCommuneGeometryLambert(
    basePoint: Point,        // WGS84 
    communeFeature: CommuneFeature,
    factor: number
): CommuneFeature {
    const [bx, by] = basePoint.toLambert() as [number, number];

    const warpPosition = (pos: Position): Position => {
        const [x, y] = pos as [number, number];
        const dx = x - bx;
        const dy = y - by;
        const warpedX = bx + dx * factor;
        const warpedY = by + dy * factor;
        return [warpedX, warpedY];
    };

    const geom = communeFeature.geometry;

    if (geom.type === "Polygon") {
        const warpedCoords: Position[][] = geom.coordinates.map((ring) =>
            ring.map(warpPosition)
        );

        return {
            ...communeFeature,
            geometry: {
                type: "Polygon",
                coordinates: warpedCoords,
            },
        };
    }

    if (geom.type === "MultiPolygon") {
        const warpedCoords: Position[][][] = geom.coordinates.map((poly) =>
            poly.map((ring) => ring.map(warpPosition))
        );

        return {
            ...communeFeature,
            geometry: {
                type: "MultiPolygon",
                coordinates: warpedCoords,
            },
        };
    }

    throw new Error("Only Polygon and MultiPolygon are supported for communes.");
}


export async function buildDeformedCommunesLayer(
    basePoint: Point      // WGS84
): Promise<FeatureCollection<Polygon | MultiPolygon, any>> {
    const communesGeojson = (await loadGeoJSON(
        "communes.geojson"
    )) as FeatureCollection<Polygon | MultiPolygon, any>;

    const features = communesGeojson.features as CommuneFeature[];
    const scaleInfos = await Promise.all(
        features.map(async (f) => {
            const { factor, carDistanceKm } = await computeScaleFactorForCommune(
                basePoint,
                f
            );
            return {
                feature: f,
                factor,
                carDistanceKm,
            };
        })
    );

    const warpedFeatures: CommuneFeature[] = scaleInfos.map(
        ({ feature, factor, carDistanceKm }) => {
            const warped = warpCommuneGeometryLambert(basePoint, feature, factor);
            return {
                ...warped,
                properties: {
                    ...warped.properties,
                    carDistanceKm,
                    carScaleFactor: factor,
                },
            };
        }
    );

    return {
        type: "FeatureCollection",
        features: warpedFeatures,
    };
}

export async function warpFeatureCollectionByCarDistance(
    basePoint: Point,
    collection: FeatureCollection<Polygon | MultiPolygon, any>
): Promise<FeatureCollection<Polygon | MultiPolygon, any>> {
    const features = collection.features as CommuneFeature[];

    const scaleInfos = await Promise.all(
        features.map(async (f) => {
            const { factor, carDistanceKm } = await computeScaleFactorForCommune(
                basePoint,
                f
            );
            return {
                feature: f,
                factor,
                carDistanceKm,
            };
        })
    );

    const warpedFeatures: CommuneFeature[] = scaleInfos.map(
        ({ feature, factor, carDistanceKm }) => {
            const warped = warpCommuneGeometryLambert(basePoint, feature, factor);
            return {
                ...warped,
                properties: {
                    ...warped.properties,
                    carDistanceKm,
                    carScaleFactor: factor,
                },
            };
        }
    );

    return {
        type: "FeatureCollection",
        features: warpedFeatures,
    };
}
