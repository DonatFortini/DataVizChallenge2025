import { useCallback, useMemo, useState } from 'react';
import type * as GeoJSONType from 'geojson';
import 'leaflet/dist/leaflet.css';
import './App.css';

import { MapView, type MarkerInfo } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { type DatasetKey, type DatasetState, initialDatasetState } from './core/datasets';
import { closestCommune, closestObjectsToBase, computeIsochrone, computeCommuneDistances, featureKey, isInCorsica, type CommuneDistanceChoropleth } from './core/engine';
import { Cooridinates, type Commune, type GeojsonFetchResponse } from './core/types';

const palette = ['#22c55e', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#6366f1', '#14b8a6'];

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

const choroplethColors = ['#15803d', '#4ade80', '#f59e0b', '#f97316', '#ef4444'];

const computeBreaks = (values: number[]): number[] => {
    if (values.length === 0) return [];
    const sorted = [...values].sort((a, b) => a - b);
    const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
    return [pick(0.25), pick(0.5), pick(0.75), sorted[sorted.length - 1]];
};

function App() {
    const [base, setBase] = useState<Cooridinates | null>(null);
    const [baseLambert, setBaseLambert] = useState<{ x: number; y: number } | null>(null);
    const [commune, setCommune] = useState<Commune | null>(null);
    const [datasets, setDatasets] = useState<Record<DatasetKey, DatasetState>>(initialDatasetState);
    const [status, setStatus] = useState<string | null>(null);
    const [isochrone, setIsochrone] = useState<GeoJSONType.Polygon | null>(null);
    const [choropleth, setChoropleth] = useState<GeoJSONType.Feature[] | null>(null);
    const [choroplethBreaks, setChoroplethBreaks] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);

    const corsicaCenter: [number, number] = [42.0396, 9.0129];

    const resetSelections = useCallback(() => {
        setCommune(null);
        setBase(null);
        setBaseLambert(null);
        setIsochrone(null);
        setChoropleth(null);
        setChoroplethBreaks([]);
        setDatasets(initialDatasetState());
    }, []);

    const loadDataset = useCallback(async (key: DatasetKey, category: string, coords: Cooridinates) => {
        setDatasets(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                loading: true,
                error: null,
                selectedCategory: category
            }
        }));
        const filter = category === 'all' ? undefined : category;
        try {
            const { items, categories } = await closestObjectsToBase(coords, key, filter);
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
    }, []);

    const handleMapClick = useCallback(async (coords: Cooridinates) => {
        setStatus('Vérification de la position...');
        setError(null);
        resetSelections();

        try {
            const lambert = coords.toLambert();
            setBaseLambert(lambert);

            const inside = await isInCorsica(coords);
            if (!inside) {
                setStatus(null);
                setError('Point en dehors de la Corse.');
                return;
            }

            const foundCommune = await closestCommune(coords) as Commune | undefined;
            if (!foundCommune) {
                setStatus(null);
                setError('Aucune commune trouvée.');
                return;
            }

            setBase(coords);
            setCommune(foundCommune);
            setIsochrone(null);
            setStatus('Chargement des données à proximité...');

            await Promise.all((['etude', 'sante', 'sport'] as DatasetKey[])
                .map(key => loadDataset(key, 'all', coords)));

            setStatus(null);
        } catch (e: any) {
            setStatus(null);
            setError(e?.message ?? 'Erreur lors de la récupération des données.');
        }
    }, [loadDataset, resetSelections]);

    const handleCategoryChange = async (key: DatasetKey, category: string) => {
        if (!base) return;
        setIsochrone(null);
        await loadDataset(key, category, base);
    };

    const toggleItemSelection = (datasetKey: DatasetKey, item: GeojsonFetchResponse) => {
        setIsochrone(null);
        const itemKey = featureKey(item);
        setDatasets(prev => {
            const current = prev[datasetKey];
            const selectedItems = { ...current.selectedItems };
            const selectedColors = { ...current.selectedColors };
            if (selectedItems[itemKey]) {
                delete selectedItems[itemKey];
                delete selectedColors[itemKey];
            } else {
                selectedItems[itemKey] = item;
                const idx = current.items.findIndex(i => featureKey(i) === itemKey);
                const color = selectedColors[itemKey] ?? current.colors[idx] ?? randomColor();
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

    const generateIsochroneFromSelection = async () => {
        if (!base) return;
        const selectedPoints = (Object.keys(datasets) as DatasetKey[])
            .flatMap(k => Object.values(datasets[k].selectedItems));
        if (selectedPoints.length === 0) return;
        const iso = computeIsochrone(base, selectedPoints.map(i => i.coordinates), { paddingKm: 1 });
        setIsochrone(iso);
        const distFeatures: CommuneDistanceChoropleth[] = await computeCommuneDistances(selectedPoints);
        setChoropleth(distFeatures.map(d => d.feature));
        setChoroplethBreaks(computeBreaks(distFeatures.map(d => d.dist)));
    };

    const communeFeature = useMemo(() => {
        if (!commune) return null;
        return {
            type: 'Feature',
            properties: commune.properties ?? {},
            geometry: commune.geometry
        } as GeoJSONType.Feature;
    }, [commune]);

    const markerPositions = useMemo<MarkerInfo[]>(() => {
        return (Object.keys(datasets) as DatasetKey[])
            .flatMap(k => {
                const ds = datasets[k];
                return Object.entries(ds.selectedItems).map(([key, item]) => ({
                    position: [item.coordinates.latitude, item.coordinates.longitude] as [number, number],
                    color: ds.selectedColors[key] ?? randomColor()
                }));
            });
    }, [datasets]);

    const isochroneFeatures = useMemo(() => {
        if (!isochrone) return [];
        return [{
            type: 'Feature',
            properties: { color: '#f97316' },
            geometry: isochrone
        }] as GeoJSONType.Feature[];
    }, [isochrone]);

    const selectedCount = useMemo(() => {
        return (Object.keys(datasets) as DatasetKey[])
            .reduce((acc, key) => acc + Object.keys(datasets[key].selectedItems).length, 0);
    }, [datasets]);

    return (
        <div className="app">
            <div className="map-pane">
                <MapView
                    base={base}
                    communeFeature={communeFeature}
                    isochroneFeatures={isochroneFeatures}
                    choroplethFeatures={choropleth ?? []}
                    choroplethBreaks={choroplethBreaks}
                    choroplethColors={choroplethColors}
                    markerPositions={markerPositions}
                    corsicaCenter={corsicaCenter}
                    onSelect={handleMapClick}
                />
            </div>
            <Sidebar
                baseLambert={baseLambert}
                error={error}
                status={status}
                commune={commune}
                datasets={datasets}
                hasBase={Boolean(base)}
                onSelectCategory={handleCategoryChange}
                onToggleItem={toggleItemSelection}
                onGenerateIsochrone={generateIsochroneFromSelection}
                canGenerate={Boolean(base) && selectedCount > 0}
                selectionCount={selectedCount}
            />
        </div>
    );
}

export default App;
