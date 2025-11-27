import type * as GeoJSON from 'geojson';
import proj4 from "proj4";

if (!proj4.defs('EPSG:2154')) {
    proj4.defs(
        'EPSG:2154',
        '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
    );
}

type QueryObject = {
    id: string;
    nom: string;
    categorie: string;
    commune: string;
    coordonnees: Coordinates;
    geometry: GeoJSON.Point;
};

function formatCoordinates(coordonnees: Coordinates): string {
    return `${Number(coordonnees[0]).toFixed(6)},${Number(coordonnees[1]).toFixed(6)}`;
}

export function ObjectKeyfromObj(obj: QueryObject): string {
    return `${obj.nom}:${formatCoordinates(obj.coordonnees)}`;
}

export function ObjectKeyfromProps(nom: string, coordonnees: Coordinates): string {
    return `${nom}:${formatCoordinates(coordonnees)}`;
}


type Commune = {
    name: string;
    neighbours: string[];
    polygon: GeoJSON.MultiPolygon;
};

// Coordinates are always stored as [latitude, longitude] in WGS84 unless otherwise noted.
type Coordinates = [number, number];
interface CoordinateTrait {
    toLambert(): Coordinates;
    toWGS(): Coordinates;
    readonly tuple: Coordinates;
}

class Point implements CoordinateTrait {
    public readonly tuple: Coordinates;
    public readonly latitude: number;
    public readonly longitude: number;

    constructor(tuple: Coordinates) {
        this.tuple = tuple;
        this.latitude = tuple[0];
        this.longitude = tuple[1];
    }
    toLambert(): Coordinates {
        const [lat, lon] = this.tuple;
        const point2154 = proj4("EPSG:4326", "EPSG:2154", [lon, lat]);
        return [point2154[0], point2154[1]];
    }
    toWGS(): Coordinates {
        const [x, y] = this.tuple;
        const point4326 = proj4("EPSG:2154", "EPSG:4326", [x, y]);
        // Return as [lat, lon] to match the app-wide convention.
        return [point4326[1], point4326[0]];
    }
}


const asPoint = (c: Coordinates) => new Point(c);
const toLambert = (c: Coordinates): Coordinates => asPoint(c).toLambert();
const toWGS = (c: Coordinates): Coordinates => asPoint(c).toWGS();


export { Point, asPoint, toLambert, toWGS };

export type ActiveTab = 'anamorphose' | 'heatmap' | 'profil';

export type {
    Coordinates,
    QueryObject,
    Commune
};

export type DatasetItem = QueryObject & {
    properties?: Record<string, unknown>;
    label?: string;
};

export type DatasetKey = 'etude' | 'sante' | 'sport';

export type DatasetState = {
    loading: boolean;
    items: DatasetItem[];
    colors: string[];
    categories: string[];
    selectedCategory: string;
    selectedItems: Record<string, DatasetItem>;
    selectedColors: Record<string, string>;
    error?: string | null;
};

export const labelMap: Record<DatasetKey, string> = {
    etude: 'Scolaire',
    sante: 'Santé',
    sport: 'Sport'
};

export const initialDatasetState = (): Record<DatasetKey, DatasetState> => ({
    etude: { loading: false, items: [], colors: [], categories: [], selectedCategory: 'all', selectedItems: {}, selectedColors: {}, error: null },
    sante: { loading: false, items: [], colors: [], categories: [], selectedCategory: 'all', selectedItems: {}, selectedColors: {}, error: null },
    sport: { loading: false, items: [], colors: [], categories: [], selectedCategory: 'all', selectedItems: {}, selectedColors: {}, error: null }
});
