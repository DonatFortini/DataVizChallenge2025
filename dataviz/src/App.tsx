import { useCallback, useMemo, useState } from 'react';
import type * as GeoJSONType from 'geojson';
import 'leaflet/dist/leaflet.css';
import './App.css';

import { MapView, type MarkerInfo } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { labelMap, type DatasetKey, type DatasetState, initialDatasetState } from './core/datasets';
import { closestTo, getCommune, isInCorsica } from './core/engine';
import { ObjectKeyfromObj, Point, toWGS, type Commune, type QueryObject } from './core/types';

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

function App() {
    const [base, setBase] = useState<Point | null>(null);
    const [baseLambert, setBaseLambert] = useState<{ x: number; y: number } | null>(null);
    const [commune, setCommune] = useState<Commune | null>(null);
    const [datasets, setDatasets] = useState<Record<DatasetKey, DatasetState>>(initialDatasetState);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'selection' | 'heatmap'>('selection');

    const corsicaCenter: [number, number] = [42.0396, 9.0129];

    const resetSelections = useCallback(() => {
        setCommune(null);
        setBase(null);
        setBaseLambert(null);
        setDatasets(initialDatasetState());
    }, []);

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

            const items = await closestTo(coords, communeToUse, key, category);
            const colors = generateColors(items.length);
            const categories = Array.from(new Set(items.map(i => i.categorie).filter(Boolean)));

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
    }, [loadDataset, resetSelections]);

    const handleCategoryChange = async (key: DatasetKey, category: string) => {
        if (!base || !commune) return;
        await loadDataset(key, category, base, commune);
    };

    const handleTabChange = (tab: 'selection' | 'heatmap') => {
        setActiveTab(tab);
    };

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

    const markerPositions = useMemo<MarkerInfo[]>(() => {
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

    return (
        <div className="app">
            <div className="map-pane">
                <MapView
                    base={base}
                    baseLabel={baseMarkerLabel}
                    communeFeature={communeFeature}
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
                activeTab={activeTab}
                onTabChange={handleTabChange}
                onSelectCategory={handleCategoryChange}
                onToggleItem={toggleItemSelection}
                selectionCount={selectedCount}
            />
        </div>
    );
}

export default App;
