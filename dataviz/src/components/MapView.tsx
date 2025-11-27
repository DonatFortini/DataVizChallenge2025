import { MapContainer, TileLayer, GeoJSON, Marker, LayerGroup, useMapEvents, Tooltip, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import type * as GeoJSONType from 'geojson';
import * as d3 from 'd3';

import { Point } from '../core/types';
import { FALLBACK_DISTANCE_KM } from '../core/distance';

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
            onSelect(new Point([e.latlng.lat, e.latlng.lng]));
        }
    });
    return null;
}

function PatternDefs() {
    const map = useMap();
    useEffect(() => {
        const pane = map.getPane('heatmap') ?? map.getPane('overlayPane');
        const svg = pane?.querySelector('svg');
        if (!svg) return;
        let defs = svg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            svg.prepend(defs);
        }
        let pattern = defs.querySelector('#commune-hatch');
        if (!pattern) {
            pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
            pattern.setAttribute('id', 'commune-hatch');
            pattern.setAttribute('patternUnits', 'userSpaceOnUse');
            pattern.setAttribute('width', '8');
            pattern.setAttribute('height', '8');

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', '8');
            rect.setAttribute('height', '8');
            rect.setAttribute('fill', 'rgba(15,23,42,0.3)');

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M0 8 L8 0 M-2 2 L2 -2 M6 10 L10 6');
            path.setAttribute('stroke', 'rgba(15,23,42,0.85)');
            path.setAttribute('stroke-width', '1.6');

            pattern.appendChild(rect);
            pattern.appendChild(path);
            defs.appendChild(pattern);
        }
    }, [map]);
    return null;
}

function HeatmapPane() {
    const map = useMap();
    useEffect(() => {
        if (!map.getPane('heatmap')) {
            map.createPane('heatmap');
        }
        const pane = map.getPane('heatmap');
        if (pane) {
            pane.style.zIndex = '350';
            pane.style.mixBlendMode = 'normal';
            pane.style.opacity = '1';
        }
    }, [map]);
    return null;
}

export type MarkerInfo = {
    position: [number, number];
    color: string;
    label?: string;
};

type HeatmapLayer = {
    features: GeoJSONType.Feature<GeoJSONType.MultiPolygon>[];
    legend: { label: string; color: string; value: number; tags?: string[] }[];
    colorFor: (communeName: string) => string;
    title?: string;
    loading?: boolean;
    range?: {
        minLabel: string;
        maxLabel: string;
        lowColor: string;
        highColor: string;
    };
    countFor: (communeName: string) => number;
    breakdownFor?: (communeName: string) => { total: number; byCategory: Record<string, number> } | undefined;
    hasZero?: boolean;
};

type AnamorphoseLayer = {
    features: GeoJSONType.Feature<GeoJSONType.MultiPolygon>[];
    warpedFeatures: GeoJSONType.Feature<GeoJSONType.MultiPolygon>[];
    weights: Record<string, number>;
    backgroundWeight: number;
    minKm: number;
    maxKm: number;
    details: Array<{ label: string; km: number }>;
    kmByCommune: Record<string, number>;
    durationByCommune: Record<string, number>;
    maxDuration?: number;
    minDuration?: number;
};

type MapViewProps = {
    base: Point | null;
    baseLabel?: string;
    communeFeature: GeoJSONType.Feature | null;
    markerPositions: MarkerInfo[];
    corsicaCenter: [number, number];
    onSelect: (coords: Point) => void;
    selectionEnabled?: boolean;
    heatmapLayer?: HeatmapLayer | null;
    heatmapLayerKey?: string;
    anamorphoseLayer?: AnamorphoseLayer | null;
    anamorphoseLoading?: boolean;
    anamorphoseError?: string | null;
};

export function MapView({
    base,
    baseLabel,
    communeFeature,
    markerPositions,
    corsicaCenter,
    onSelect,
    selectionEnabled = true,
    heatmapLayer,
    heatmapLayerKey,
    anamorphoseLayer,
}: MapViewProps) {
    const canSelect = selectionEnabled !== false;

    return (
        <div className="map-wrapper">
            <MapContainer center={corsicaCenter} zoom={8} scrollWheelZoom className="map">
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {heatmapLayer && <HeatmapPane />}
                {heatmapLayer && <PatternDefs />}
                {canSelect && <ClickHandler onSelect={onSelect} />}
                {communeFeature && (
                    <GeoJSON key={`${communeFeature.properties?.nom ?? 'commune'}`} data={communeFeature} style={{ color: '#2563eb', weight: 2 }} />
                )}
                {anamorphoseLayer && anamorphoseLayer.warpedFeatures.length > 0 && (
                    <GeoJSON
                        key="anamorphose-polygons"
                        pane="heatmap"
                        data={{ type: 'FeatureCollection', features: anamorphoseLayer.warpedFeatures } as GeoJSONType.FeatureCollection<GeoJSONType.MultiPolygon>}
                        style={(feature) => {
                            const name = (feature?.properties as any)?.nom ?? '';
                            const dur = anamorphoseLayer.durationByCommune[name];
                            const span = Math.max(1, (anamorphoseLayer.maxDuration || 1) - (anamorphoseLayer.minDuration || 0));
                            const t = dur != null && dur < Number.POSITIVE_INFINITY
                                ? 1 - Math.min(1, Math.max(0, (dur - (anamorphoseLayer.minDuration || 0)) / span))
                                : 0;
                            const color = d3.interpolateMagma(t);
                            return {
                                color: '#0f172a',
                                weight: 1,
                                fillColor: color,
                                fillOpacity: 0.75,
                                opacity: 1
                            };
                        }}
                        onEachFeature={(feature, layer) => {
                            const name = (feature?.properties as any)?.nom ?? 'Commune';
                            const dur = anamorphoseLayer.durationByCommune[name];
                            const km = anamorphoseLayer.kmByCommune[name];
                            const label = dur != null && dur < Number.POSITIVE_INFINITY ? `${dur.toFixed(1)} min` : km != null && km < FALLBACK_DISTANCE_KM ? `${km.toFixed(1)} km` : 'distance inconnue (OSRM)';
                            const content = `<div class="tooltip">${name} — ${label}</div>`;
                            layer.bindTooltip(content, { direction: 'top', opacity: 0.95, className: '' });
                        }}
                    />
                )}
                {heatmapLayer && heatmapLayer.features.length > 0 && (
                    <GeoJSON
                        key={heatmapLayerKey ?? 'heatmap-polygons'}
                        pane="heatmap"
                        data={{ type: 'FeatureCollection', features: heatmapLayer.features } as GeoJSONType.FeatureCollection<GeoJSONType.MultiPolygon>}
                        style={(feature) => {
                            const name = (feature?.properties as any)?.nom ?? '';
                            const count = heatmapLayer.countFor(name) ?? 0;
                            const color = heatmapLayer.colorFor(name);
                            const isEmpty = count === 0;
                            return {
                                color: '#0f172a',
                                weight: 1,
                                fillColor: isEmpty ? 'url(#commune-hatch)' : color,
                                fillOpacity: isEmpty ? 0.7 : 0.65,
                                opacity: 1
                            };
                        }}
                        onEachFeature={(feature, layer) => {
                            const name = (feature?.properties as any)?.nom ?? 'Commune';
                            const count = heatmapLayer.countFor(name) ?? 0;
                            const breakdown = heatmapLayer.breakdownFor?.(name);
                            const list = breakdown
                                ? Object.entries(breakdown.byCategory)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([cat, value]) => `<div>${cat}: ${value}</div>`)
                                    .join('')
                                : '';
                            const content = `<div class="tooltip">${name} — ${count} structure${count > 1 ? 's' : ''}${list ? `<div class="muted">${list}</div>` : ''}</div>`;
                            layer.bindTooltip(content, { direction: 'top', opacity: 0.95, className: '' });
                        }}
                    />
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
            {heatmapLayer && (
                <div className="map-overlay">
                    <div className="map-legend">
                        <div>{heatmapLayer.title ?? 'Heatmap'}</div>
                        {heatmapLayer.loading && <div className="small">Chargement...</div>}
                        {heatmapLayer.range && (
                            <div className="legend-gradient">
                                <span className="legend-min">{heatmapLayer.range.minLabel}</span>
                                <div
                                    className="legend-bar"
                                    style={{ background: `linear-gradient(90deg, ${heatmapLayer.range.lowColor}, ${heatmapLayer.range.highColor})` }}
                                />
                                <span className="legend-max">{heatmapLayer.range.maxLabel}</span>
                            </div>
                        )}
                        {heatmapLayer.legend.length > 0 && (
                            <ul>
                                {heatmapLayer.hasZero && (
                                    <li>
                                        <span className="legend-hatch" />
                                        <span>0 structure (hachuré)</span>
                                    </li>
                                )}
                                {heatmapLayer.legend
                                    .filter(stop => !(heatmapLayer.hasZero && stop.value === 0))
                                    .map((stop, idx) => (
                                        <li key={`${stop.color}-${stop.value}-${idx}`}>
                                            <span style={{ background: stop.color }} />
                                            <span>
                                                {stop.label}
                                                {stop.tags?.length ? ` (${stop.tags.join(', ')})` : ''}
                                            </span>
                                        </li>
                                    ))}
                            </ul>
                        )}
                        {!heatmapLayer.loading && heatmapLayer.legend.length === 0 && (
                            <div className="small muted">Aucune donnée à afficher.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
