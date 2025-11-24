import type * as GeoJSON from 'geojson';
import proj4 from "proj4";

type QueryObject = {
    nom: string;
    categorie: string;
    commune: string;
    coordonnees: string;
    geometry: GeoJSON.Point;
};

type Commune = {
    name: string;
    neighbours: string[];
    polygon: GeoJSON.MultiPolygon;
};

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
        this.latitude = tuple[1];
        this.longitude = tuple[0];
    }
    toLambert(): Coordinates {
        const [lon, lat] = this.tuple;
        const point2154 = proj4("EPSG:4326", "EPSG:2154", [lon, lat]);
        return [point2154[0], point2154[1]];
    }
    toWGS(): Coordinates {
        const [x, y] = this.tuple;
        const point4326 = proj4("EPSG:2154", "EPSG:4326", [x, y]);
        return [point4326[0], point4326[1]];
    }
}


const asPoint = (c: Coordinates) => new Point(c);
const toLambert = (c: Coordinates): Coordinates => asPoint(c).toLambert();
const toWGS = (c: Coordinates): Coordinates => asPoint(c).toWGS();

export { Point, asPoint, toLambert, toWGS };


export type {
    Coordinates,
    QueryObject,
    Commune
};
