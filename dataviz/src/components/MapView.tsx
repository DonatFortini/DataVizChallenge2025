import { MapContainer, TileLayer, GeoJSON, Marker, LayerGroup, useMapEvents, Circle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type * as GeoJSONType from 'geojson';

import { Cooridinates } from '../core/types';
import type { HeatmapPoint } from '../core/engine';

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
    label?: string;
};

type MapViewProps = {
    base: Cooridinates | null;
    baseLabel?: string;
    communeFeature: GeoJSONType.Feature | null;
    isochroneFeatures: GeoJSONType.Feature[];
    choroplethFeatures: GeoJSONType.Feature[];
    choroplethBreaks: number[];
    choroplethColors: string[];
    heatmapPoints: HeatmapPoint[];
    heatmapBreaks: number[];
    heatmapColors: string[];
    heatmapLabel: string;
    heatmapActive: boolean;
    markerPositions: MarkerInfo[];
    corsicaCenter: [number, number];
    onSelect: (coords: Cooridinates) => void;
};

export function MapView({
    base,
    baseLabel,
    communeFeature,
    isochroneFeatures,
    choroplethFeatures,
    choroplethBreaks,
    choroplethColors,
    heatmapPoints,
    heatmapBreaks,
    heatmapColors,
    heatmapLabel,
    heatmapActive,
    markerPositions,
    corsicaCenter,
    onSelect
}: MapViewProps) {
    const getHeatColor = (intensity: number) => {
        const breaks = heatmapBreaks.length > 0 ? heatmapBreaks : [0.5, 1, 2, 3];
        const colors = heatmapColors.length > 0 ? heatmapColors : ['#dc2626', '#f97316', '#facc15', '#38bdf8', '#2563eb'];
        const idx = breaks.findIndex((b: number) => intensity <= b);
        return idx === -1 ? colors[colors.length - 1] : colors[Math.min(idx, colors.length - 1)];
    };

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
                {heatmapActive && heatmapPoints.length > 0 && (
                    <LayerGroup>
                        {heatmapPoints.map((p, idx) => {
                            const color = getHeatColor(p.intensity);
                            const radius = Math.min(
                                2500,
                                Math.max(180, p.intensity * 450) * Math.max(1, Math.sqrt(p.neighborCount))
                            );
                            return (
                                <Circle
                                    key={`heat-${idx}`}
                                    center={[p.coordinates.latitude, p.coordinates.longitude]}
                                    radius={radius}
                                    pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 0 }}
                                >
                                    <Tooltip direction="top" offset={[0, -4]} opacity={0.9} permanent={false}>
                                        <div className="tooltip">
                                            <strong>{heatmapLabel}</strong>
                                            <div>Catégorie : {p.category ?? 'n/a'}</div>
                                            <div>Score : {p.intensity.toFixed(2)}</div>
                                            <div>Voisins (≤15 km) : {p.neighborCount}</div>
                                            <div>Proximité : {p.dist.toFixed(2)} km</div>
                                        </div>
                                    </Tooltip>
                                </Circle>
                            );
                        })}
                    </LayerGroup>
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

            <div className="map-overlay">
                {choroplethBreaks.length > 0 && (
                    <div className="map-legend">
                        <strong>Distance au plus proche</strong>
                        <ul>
                            {choroplethBreaks.map((b, idx) => {
                                const prev = idx === 0 ? 0 : choroplethBreaks[idx - 1];
                                const label = idx === 0
                                    ? `≤ ${b.toFixed(2)} km`
                                    : `${prev.toFixed(2)} - ${b.toFixed(2)} km`;
                                const color = choroplethColors[Math.min(idx, choroplethColors.length - 1)];
                                return <li key={idx}><span style={{ background: color }} />{label}</li>;
                            })}
                            <li><span style={{ background: choroplethColors[choroplethColors.length - 1] }} />{`> ${choroplethBreaks[choroplethBreaks.length - 1].toFixed(2)} km`}</li>
                        </ul>
                    </div>
                )}
                {heatmapActive && heatmapBreaks.length > 0 && (
                    <div className="map-legend">
                        <strong>{heatmapLabel}</strong>
                        <ul>
                            {heatmapBreaks.map((b, idx) => {
                                const prev = idx === 0 ? 0 : heatmapBreaks[idx - 1];
                                const label = idx === 0 ? `≤ ${b.toFixed(2)}` : `${prev.toFixed(2)} - ${b.toFixed(2)}`;
                                const color = heatmapColors[Math.min(idx, heatmapColors.length - 1)];
                                return <li key={`heat-break-${idx}`}><span style={{ background: color }} />{label}</li>;
                            })}
                            <li><span style={{ background: heatmapColors[heatmapColors.length - 1] }} />{`> ${heatmapBreaks[heatmapBreaks.length - 1].toFixed(2)}`}</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
