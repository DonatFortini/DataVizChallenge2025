import { MapContainer, TileLayer, GeoJSON, Marker, LayerGroup, useMapEvents, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type * as GeoJSONType from 'geojson';

import { Point } from '../core/types';


const DefaultIcon = (color: string) => L.divIcon({
    className: 'custom-marker',
    html: `<div style="
        background:${color};
        border:2px solid #fff;
        width:16px;
        height:16px;
        border-radius:50%;
        box-shadow:0 0 0 2px rgba(0,0,0,0.2);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

const createColoredIcon = (color: string) => DefaultIcon(color);

type ClickHandlerProps = { onSelect: (coords: Point) => void };
function ClickHandler({ onSelect }: ClickHandlerProps) {
    useMapEvents({
        click: (e) => {
            onSelect(new Point([e.latlng.lng, e.latlng.lat]));
        }
    });
    return null;
}

export type MarkerInfo = {
    position: [number, number];
    color: string;
    label?: string;
};

type MapViewProps = {
    base: Point | null;
    baseLabel?: string;
    communeFeature: GeoJSONType.Feature | null;
    markerPositions: MarkerInfo[];
    corsicaCenter: [number, number];
    onSelect: (coords: Point) => void;
};

export function MapView({
    base,
    baseLabel,
    communeFeature,
    markerPositions,
    corsicaCenter,
    onSelect
}: MapViewProps) {
    return (
        <div className="map-wrapper">
            <MapContainer center={corsicaCenter} zoom={8} scrollWheelZoom className="map">
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ClickHandler onSelect={onSelect} />
                {communeFeature && (
                    <GeoJSON key={`${communeFeature.properties?.nom ?? 'commune'}`} data={communeFeature} style={{ color: '#2563eb', weight: 2 }} />
                )}
                <LayerGroup>
                    {markerPositions.map((m, idx) => (
                        <Marker key={`m-${idx}`} position={m.position} icon={createColoredIcon(m.color)}>
                            {m.label && (
                                <Tooltip opacity={0.95} direction="top" offset={[0, -4]}>
                                    <div className="tooltip">{m.label}</div>
                                </Tooltip>
                            )}
                        </Marker>
                    ))}
                </LayerGroup>
                {base && (
                    <Marker position={[base.latitude, base.longitude]} icon={createColoredIcon('#ef4444')}>
                        <Tooltip opacity={0.95} direction="top" offset={[0, -6]}>
                            <div className="tooltip">{baseLabel ?? 'Point sélectionné'}</div>
                        </Tooltip>
                    </Marker>
                )}
            </MapContainer>
        </div>
    );
}
