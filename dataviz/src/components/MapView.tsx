import { MapContainer, TileLayer, GeoJSON, Marker, LayerGroup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type * as GeoJSONType from 'geojson';

import { Cooridinates } from '../core/types';

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

type ClickHandlerProps = { onSelect: (coords: Cooridinates) => void };
function ClickHandler({ onSelect }: ClickHandlerProps) {
    useMapEvents({
        click: (e) => {
            onSelect(new Cooridinates(e.latlng.lat, e.latlng.lng));
        }
    });
    return null;
}

export type MarkerInfo = {
    position: [number, number];
    color: string;
};

type MapViewProps = {
    base: Cooridinates | null;
    communeFeature: GeoJSONType.Feature | null;
    isochroneFeatures: GeoJSONType.Feature[];
    choroplethFeatures: GeoJSONType.Feature[];
    choroplethBreaks: number[];
    choroplethColors: string[];
    markerPositions: MarkerInfo[];
    corsicaCenter: [number, number];
    onSelect: (coords: Cooridinates) => void;
};

export function MapView({
    base,
    communeFeature,
    isochroneFeatures,
    choroplethFeatures,
    choroplethBreaks,
    choroplethColors,
    markerPositions,
    corsicaCenter,
    onSelect
}: MapViewProps) {
    return (
        <MapContainer center={corsicaCenter} zoom={8} scrollWheelZoom className="map">
            <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onSelect={onSelect} />
            {communeFeature && (
                <GeoJSON key={`${communeFeature.properties?.nom ?? 'commune'}`} data={communeFeature} style={{ color: '#2563eb', weight: 2 }} />
            )}
            {choroplethFeatures.length > 0 && (
                <GeoJSON
                    key="choropleth"
                    data={{ type: 'FeatureCollection', features: choroplethFeatures } as any}
                    style={(feat: any) => {
                        const dist = feat.properties?.dist ?? 0;
                        const breaks = choroplethBreaks.length > 0 ? choroplethBreaks : [5, 10, 20, 30];
                        const colors = choroplethColors.length > 0 ? choroplethColors : ['#15803d', '#4ade80', '#f59e0b', '#f97316', '#ef4444'];
                        const idx = breaks.findIndex((b: number) => dist <= b);
                        const color = idx === -1 ? colors[colors.length - 1] : colors[Math.min(idx, colors.length - 1)];
                        return { color, weight: 0.5, fillOpacity: 0.25, fillColor: color };
                    }}
                />
            )}
            {isochroneFeatures.map((feat, idx) => (
                <GeoJSON
                    key={`iso-${idx}`}
                    data={feat}
                    style={{ color: (feat.properties as any)?.color ?? '#f97316', weight: 1, fillOpacity: 0.2 }}
                />
            ))}
            <LayerGroup>
                {markerPositions.map((m, idx) => (
                    <Marker key={`m-${idx}`} position={m.position} icon={createColoredIcon(m.color)} />
                ))}
            </LayerGroup>
            {base && <Marker position={[base.latitude, base.longitude]} icon={createColoredIcon('#ef4444')} />}
            {choroplethBreaks.length > 0 && (
                <div className="map-legend">
                    <strong>Distance au plus proche</strong>
                    <ul>
                        {choroplethBreaks.map((b, idx) => {
                            const prev = idx === 0 ? 0 : choroplethBreaks[idx - 1];
                            const label = idx === 0 ? `≤ ${b} km` : `${prev} - ${b} km`;
                            const color = choroplethColors[Math.min(idx, choroplethColors.length - 1)];
                            return <li key={idx}><span style={{ background: color }} />{label}</li>;
                        })}
                        <li><span style={{ background: choroplethColors[choroplethColors.length - 1] }} />{`> ${choroplethBreaks[choroplethBreaks.length - 1]} km`}</li>
                    </ul>
                </div>
            )}
        </MapContainer>
    );
}
