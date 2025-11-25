import { useCallback, useEffect, useMemo, useState } from 'react';
import type * as GeoJSONType from 'geojson';
import 'leaflet/dist/leaflet.css';
import './App.css';

import { MapView, type MarkerInfo } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { labelMap, type DatasetKey, type DatasetState, initialDatasetState } from './core/datasets';
import { ObjectsIn, closestTo, getCommune, isInCorsica, loadGeoJSON } from './core/engine';
import { ObjectKeyfromObj, Point, toWGS, type Commune, type QueryObject } from './core/types';

const palette = ['#22c55e', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#6366f1', '#14b8a6'];

type ActiveTab = 'selection' | 'heatmap' | 'profil';
type ProfilMarker = MarkerInfo;

const generateColors = (count: number): string[] => {
    const colors: string[] = [];
    let idx = 0;
    for (let i = 0; i < count; i++) {
        colors.push(palette[idx % palette.length]);
        idx++;
    }
    return colors;
};

const randomColor = () => palette[Math.floor(Math.random() * palette.length)];

const buildMarkerLabel = (datasetKey: DatasetKey, item: QueryObject): string => {
    const datasetLabel = labelMap[datasetKey] ?? datasetKey;
    const title = item.nom ?? 'Objet';
    const cat = item.categorie;
    const communeName = item.commune;
    const segments = [datasetLabel, title];
    if (cat) segments.push(cat);
    if (communeName) segments.push(communeName);
    return segments.join(' — ');
};

const convertMultiPolygonToWGS = (polygon: GeoJSONType.MultiPolygon): GeoJSONType.MultiPolygon => ({
    type: 'MultiPolygon',
    coordinates: polygon.coordinates.map(poly =>
        poly.map(ring =>
            ring.map(coord => {
                const [lon, lat] = toWGS(coord as [number, number]);
                return [lon, lat];
            })
        )
    )
});

const interpolateChannel = (start: number, end: number, t: number) => Math.round(start + (end - start) * t);
const toHex = (value: number) => value.toString(16).padStart(2, '0');
const rgbToHex = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

const availabilityColor = (value: number, min: number, max: number, scaleMax?: number): string => {
    const targetMax = Math.max(scaleMax ?? max, 1);
    const range = Math.max(targetMax - min, 1);
    const ratioRaw = Math.max(0, Math.min(1, (value - min) / range));
    const ratio = Math.pow(ratioRaw, 0.55); // boost low values for readability
    const low = [15, 31, 58]; // deep slate
    const high = [242, 124, 67]; // warm orange
    const r = interpolateChannel(low[0], high[0], ratio);
    const g = interpolateChannel(low[1], high[1], ratio);
    const b = interpolateChannel(low[2], high[2], ratio);
    return rgbToHex(r, g, b);
};

const formatLegendValue = (value: number) => `${value} structure${value > 1 ? 's' : ''}`;
const buildLegendStops = (min: number, max: number, scaleMax: number, quantiles?: { p50: number; p90: number }) => {
    if (max === 0 && min === 0) {
        return [{ label: '0 structure', color: availabilityColor(0, 0, 1), value: 0, tags: ['min', 'p50', 'p90', 'max'] }];
    }

    const candidates: Array<{ raw: number; tag: string }> = [
        { raw: min, tag: 'min' },
        { raw: quantiles?.p50 ?? min, tag: 'p50' },
        { raw: quantiles?.p90 ?? max, tag: 'p90' },
        { raw: max, tag: 'max' },
        { raw: scaleMax, tag: scaleMax > max ? 'cap' : 'max' }
    ];

    const bucket = new Map<number, { value: number; tags: string[] }>();
    for (const { raw, tag } of candidates) {
        const value = Math.round(raw);
        const current = bucket.get(value);
        if (current) {
            if (!current.tags.includes(tag)) current.tags.push(tag);
        } else {
            bucket.set(value, { value, tags: [tag] });
        }
    }

    const stops = Array.from(bucket.values())
        .sort((a, b) => a.value - b.value)
        .map(({ value, tags }) => ({
            value,
            color: availabilityColor(value, min, scaleMax),
            label: formatLegendValue(value),
            tags
        }));

    return stops;
};

function App() {
    const [base, setBase] = useState<Point | null>(null);
    const [baseLambert, setBaseLambert] = useState<{ x: number; y: number } | null>(null);
    const [commune, setCommune] = useState<Commune | null>(null);
    const [datasets, setDatasets] = useState<Record<DatasetKey, DatasetState>>(initialDatasetState);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('heatmap');
    const [communeFeatures, setCommuneFeatures] = useState<GeoJSONType.Feature<GeoJSONType.MultiPolygon>[]>([]);

    const [heatmapDataset, setHeatmapDataset] = useState<DatasetKey>('sante');
    const [heatmapCategory, setHeatmapCategory] = useState<string>('all');
    const [heatmapCategories, setHeatmapCategories] = useState<Record<DatasetKey, string[]>>({
        etude: [],
        sante: [],
        sport: []
    });
    const [profilMarkers, setProfilMarkers] = useState<ProfilMarker[]>([]);
    const [heatmapData, setHeatmapData] = useState<{
        counts: Record<string, number>;
        min: number;
        max: number;
        scaleMax: number;
        quantiles: { p50: number; p90: number };
        breakdown: Record<string, { total: number; byCategory: Record<string, number> }>;
    } | null>(null);
    const [heatmapLoading, setHeatmapLoading] = useState(false);
    const [heatmapError, setHeatmapError] = useState<string | null>(null);

    const corsicaCenter: [number, number] = [42.0396, 9.0129];

    const resetSelections = useCallback(() => {
        setCommune(null);
        setBase(null);
        setBaseLambert(null);
        setDatasets(initialDatasetState());
    }, []);

    const ensureCommunePolygons = useCallback(async (): Promise<GeoJSONType.Feature<GeoJSONType.MultiPolygon>[]> => {
        if (communeFeatures.length > 0) return communeFeatures;
        const geojson = await loadGeoJSON('communes.geojson');
        const converted = geojson.features.map((feature: any) => ({
            type: 'Feature',
            properties: feature.properties,
            geometry: convertMultiPolygonToWGS(feature.geometry as GeoJSONType.MultiPolygon)
        })) as GeoJSONType.Feature<GeoJSONType.MultiPolygon>[];
        setCommuneFeatures(converted);
        return converted;
    }, [communeFeatures]);

    const ensureHeatmapCategories = useCallback(async (dataset: DatasetKey) => {
        const existing = heatmapCategories[dataset];
        if (existing && existing.length > 0) return existing;
        const allObjects = await ObjectsIn(dataset, 'all');
        const categories = Array.from(new Set(allObjects.map(i => i.categorie).filter(Boolean)));
        setHeatmapCategories(prev => ({ ...prev, [dataset]: categories }));
        return categories;
    }, [heatmapCategories]);

    useEffect(() => {
        ensureCommunePolygons().catch(() => {
            setHeatmapError('Impossible de charger la carte des communes.');
        });
        (['etude', 'sante', 'sport'] as DatasetKey[]).forEach(dataset => {
            ensureHeatmapCategories(dataset).catch(() => null);
        });
    }, [ensureCommunePolygons, ensureHeatmapCategories]);

    const loadDataset = useCallback(async (key: DatasetKey, category: string, coords: Point, ctxCommune?: Commune | null) => {
        setDatasets(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                loading: true,
                error: null,
                selectedCategory: category
            }
        }));

        try {
            const communeToUse = ctxCommune ?? commune;
            if (!communeToUse) {
                throw new Error('Commune introuvable.');
            }

            const [items, categories] = await Promise.all([
                closestTo(coords, communeToUse, key, category),
                ensureHeatmapCategories(key).catch(() => [])
            ]);
            const colors = generateColors(items.length);

            setDatasets(prev => ({
                ...prev,
                [key]: {
                    ...prev[key],
                    loading: false,
                    items,
                    colors,
                    categories,
                    selectedCategory: category,
                    error: null
                }
            }));
        } catch (e: any) {
            setDatasets(prev => ({
                ...prev,
                [key]: { ...prev[key], loading: false, error: e?.message ?? 'Erreur de chargement' }
            }));
        }
    }, [commune]);

    const handleMapClick = useCallback(async (coords: Point) => {
        if (activeTab === 'heatmap') return;
        setStatus('Vérification de la position...');
        setError(null);
        resetSelections();

        try {
            const lambert = coords.toLambert();
            setBaseLambert({ x: lambert[0], y: lambert[1] });

            const inside = await isInCorsica(coords);
            if (!inside) {
                setStatus(null);
                setError('Point en dehors de la Corse.');
                return;
            }

            const foundCommune = await getCommune(coords);
            setCommune(foundCommune);
            setBase(coords);
            setStatus('Chargement des données à proximité...');

            await Promise.all((['etude', 'sante', 'sport'] as DatasetKey[])
                .map(key => loadDataset(key, 'all', coords, foundCommune)));

            setStatus(null);
        } catch (e: any) {
            setStatus(null);
            setError(e?.message ?? 'Erreur lors de la récupération des données.');
        }
    }, [activeTab, loadDataset, resetSelections]);

    const handleCategoryChange = async (key: DatasetKey, category: string) => {
        if (!base || !commune) return;
        await loadDataset(key, category, base, commune);
    };

    const loadHeatmapData = useCallback(async (dataset: DatasetKey, category: string) => {
        setHeatmapLoading(true);
        setHeatmapError(null);
        try {
            const [features, objects] = await Promise.all([
                ensureCommunePolygons(),
                ObjectsIn(dataset, category)
            ]);
            ensureHeatmapCategories(dataset).catch(() => null);

            const counts: Record<string, number> = {};
            const breakdown: Record<string, { total: number; byCategory: Record<string, number> }> = {};
            features.forEach(feature => {
                const name = (feature.properties as any)?.nom ?? '';
                if (name) {
                    counts[name] = 0;
                    breakdown[name] = { total: 0, byCategory: {} };
                }
            });
            for (const obj of objects) {
                const communeName = obj.commune ?? '';
                if (!communeName) continue;
                if (!breakdown[communeName]) {
                    breakdown[communeName] = { total: 0, byCategory: {} };
                }
                const entry = breakdown[communeName];
                entry.total += 1;
                const cat = obj.categorie || 'Autre';
                entry.byCategory[cat] = (entry.byCategory[cat] ?? 0) + 1;
                counts[communeName] = entry.total;
            }

            const values = Object.values(counts);
            const min = values.length ? Math.min(...values) : 0;
            const max = values.length ? Math.max(...values) : 0;

            const sorted = [...values].sort((a, b) => a - b);
            const quantile = (p: number) => {
                if (!sorted.length) return 0;
                const idx = (sorted.length - 1) * p;
                const lo = Math.floor(idx);
                const hi = Math.ceil(idx);
                if (lo === hi) return sorted[lo];
                const frac = idx - lo;
                return sorted[lo] * (1 - frac) + sorted[hi] * frac;
            };

            const p50 = quantile(0.5);
            const p90 = quantile(0.9);
            const scaleMax = Math.max(p90 || max, max, 1);

            setHeatmapData({ counts, min, max, scaleMax, quantiles: { p50, p90 }, breakdown });
        } catch (e: any) {
            setHeatmapError(e?.message ?? 'Erreur lors du chargement de la heatmap.');
            setHeatmapData(null);
        } finally {
            setHeatmapLoading(false);
        }
    }, [ensureCommunePolygons, ensureHeatmapCategories]);

    const clearSelectedItems = () => {
        setDatasets(prev => {
            const next: Record<DatasetKey, DatasetState> = { ...prev };
            (Object.keys(next) as DatasetKey[]).forEach(key => {
                next[key] = {
                    ...next[key],
                    selectedItems: {},
                    selectedColors: {}
                };
            });
            return next;
        });
    };

    const handleTabChange = (tab: ActiveTab) => {
        if (tab === activeTab) return;
        clearSelectedItems();
        setActiveTab(tab);
        if (tab === 'heatmap') {
            resetSelections();
            setStatus(null);
            setError(null);
        }
        if (tab !== 'profil') {
            setProfilMarkers([]);
        }
    };

    const handleHeatmapDatasetChange = (dataset: DatasetKey) => {
        setHeatmapDataset(dataset);
        setHeatmapCategory('all');
    };

    const handleHeatmapCategoryChange = (category: string) => {
        setHeatmapCategory(category);
    };

    useEffect(() => {
        if (activeTab !== 'heatmap') return;
        loadHeatmapData(heatmapDataset, heatmapCategory);
    }, [activeTab, heatmapCategory, heatmapDataset, loadHeatmapData]);

    const toggleItemSelection = (datasetKey: DatasetKey, item: QueryObject) => {
        const itemKey = ObjectKeyfromObj(item);
        setDatasets(prev => {
            const current = prev[datasetKey];
            const selectedItems = { ...current.selectedItems };
            const selectedColors = { ...current.selectedColors };
            if (selectedItems[itemKey]) {
                delete selectedItems[itemKey];
                delete selectedColors[itemKey];
            } else {
                const idx = current.items.findIndex(i => ObjectKeyfromObj(i) === itemKey);
                const color = selectedColors[itemKey] ?? current.colors[idx] ?? randomColor();
                selectedItems[itemKey] = item;
                selectedColors[itemKey] = color;
            }
            return {
                ...prev,
                [datasetKey]: {
                    ...current,
                    selectedItems,
                    selectedColors
                }
            };
        });
    };

    const communeFeature = useMemo(() => {
        if (!commune) return null;
        return {
            type: 'Feature',
            properties: { nom: commune.name },
            geometry: convertMultiPolygonToWGS(commune.polygon)
        } as GeoJSONType.Feature;
    }, [commune]);

    const selectionMarkers = useMemo<MarkerInfo[]>(() => {
        return (Object.keys(datasets) as DatasetKey[])
            .flatMap(k => {
                const ds = datasets[k];
                return Object.entries(ds.selectedItems).map(([selectedKey, item]) => {
                    const idx = ds.items.findIndex(i => ObjectKeyfromObj(i) === selectedKey);
                    const color = ds.selectedColors[selectedKey] ?? ds.colors[idx] ?? randomColor();
                    const [lon, lat] = item.coordonnees;
                    return {
                        position: [lat, lon] as [number, number],
                        color,
                        label: buildMarkerLabel(k, item)
                    };
                });
            });
    }, [datasets]);

    const markerPositions = useMemo<MarkerInfo[]>(() => {
        if (activeTab === 'profil') {
            return [...selectionMarkers, ...profilMarkers];
        }
        return selectionMarkers;
    }, [activeTab, profilMarkers, selectionMarkers]);

    const selectedCount = useMemo(() => {
        return (Object.keys(datasets) as DatasetKey[])
            .reduce((acc, key) => acc + Object.keys(datasets[key].selectedItems).length, 0);
    }, [datasets]);

    const baseMarkerLabel = useMemo(() => {
        if (!base) return 'Point sélectionné';
        const coords = `${base.latitude.toFixed(4)}, ${base.longitude.toFixed(4)}`;
        if (commune?.name) {
            return `Point sélectionné • ${commune.name} • ${coords}`;
        }
        return `Point sélectionné • ${coords}`;
    }, [base, commune]);

    const heatmapLegend = useMemo(() => {
        if (!heatmapData) return [];
        return buildLegendStops(heatmapData.min, heatmapData.max, heatmapData.scaleMax, heatmapData.quantiles);
    }, [heatmapData]);

    const heatmapRange = useMemo(() => {
        if (!heatmapData) return null;
        const minLabel = formatLegendValue(heatmapData.min);
        const maxLabel = formatLegendValue(heatmapData.max);
        const lowColor = availabilityColor(heatmapData.min, heatmapData.min, heatmapData.scaleMax);
        const highColor = availabilityColor(heatmapData.max, heatmapData.min, heatmapData.scaleMax);
        return { minLabel, maxLabel, lowColor, highColor };
    }, [heatmapData]);

    const heatmapColorFor = useCallback((communeName: string) => {
        if (!heatmapData) return '#3b82f6';
        const value = heatmapData.counts[communeName] ?? 0;
        return availabilityColor(value, heatmapData.min, heatmapData.scaleMax);
    }, [heatmapData]);

    const heatmapTitle = useMemo(() => {
        const datasetLabel = labelMap[heatmapDataset] ?? heatmapDataset;
        const categoryLabel = heatmapCategory === 'all' ? 'Toutes catégories' : heatmapCategory;
        return `${datasetLabel} • ${categoryLabel}`;
    }, [heatmapCategory, heatmapDataset]);

    const heatmapLayerKey = useMemo(() => {
        if (activeTab !== 'heatmap') return '';
        return `${heatmapDataset}-${heatmapCategory}-${heatmapData?.min ?? 0}-${heatmapData?.max ?? 0}`;
    }, [activeTab, heatmapCategory, heatmapData?.max, heatmapData?.min, heatmapDataset]);

    const isInteractiveTab = activeTab !== 'heatmap';

    return (
        <div className="app">
            <div className="map-pane">
                <MapView
                    base={isInteractiveTab ? base : null}
                    baseLabel={baseMarkerLabel}
                    communeFeature={isInteractiveTab ? communeFeature : null}
                    markerPositions={isInteractiveTab ? markerPositions : []}
                    corsicaCenter={corsicaCenter}
                    onSelect={handleMapClick}
                    selectionEnabled={isInteractiveTab}
                    heatmapLayerKey={heatmapLayerKey}
                    heatmapLayer={activeTab === 'heatmap' && communeFeatures.length > 0 ? {
                        features: communeFeatures,
                        legend: heatmapLegend,
                        colorFor: heatmapColorFor,
                        title: heatmapTitle,
                        loading: heatmapLoading,
                        range: heatmapRange ?? undefined,
                        countFor: (name: string) => heatmapData?.counts[name] ?? 0,
                        breakdownFor: (name: string) => heatmapData?.breakdown[name],
                        hasZero: Object.values(heatmapData?.counts ?? {}).some(v => v === 0)
                    } : null}
                />
            </div>
            <Sidebar
                baseLambert={baseLambert}
                error={error}
                status={status}
                basePoint={base}
                commune={commune}
                datasets={datasets}
                hasBase={Boolean(base)}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                onSelectCategory={handleCategoryChange}
                onToggleItem={toggleItemSelection}
                selectionCount={selectedCount}
                heatmapDataset={heatmapDataset}
                heatmapCategory={heatmapCategory}
                heatmapCategories={heatmapCategories}
                heatmapLoading={heatmapLoading}
                heatmapError={heatmapError}
                onHeatmapDatasetChange={handleHeatmapDatasetChange}
                onHeatmapCategoryChange={handleHeatmapCategoryChange}
                onProfilMarkersChange={setProfilMarkers}
            />
        </div>
    );
}

export default App;
