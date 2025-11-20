import { useCallback, useMemo, useState } from 'react';
import type * as GeoJSONType from 'geojson';
import 'leaflet/dist/leaflet.css';
import './App.css';

import { MapView, type MarkerInfo } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { type DatasetKey, type DatasetState, initialDatasetState } from './core/datasets';
import { closestCommune, closestObjectsToBase, computeIsochrone, isInCorsica } from './core/engine';
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

function App() {
    const [base, setBase] = useState<Cooridinates | null>(null);
    const [baseLambert, setBaseLambert] = useState<{ x: number; y: number } | null>(null);
    const [commune, setCommune] = useState<Commune | null>(null);
    const [datasets, setDatasets] = useState<Record<DatasetKey, DatasetState>>(initialDatasetState);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const corsicaCenter: [number, number] = [42.0396, 9.0129];

    const resetSelections = useCallback(() => {
        setCommune(null);
        setBase(null);
        setBaseLambert(null);
        setDatasets(initialDatasetState());
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
            setDatasets(initialDatasetState());
            setStatus(null);
        } catch (e: any) {
            setStatus(null);
            setError(e?.message ?? 'Erreur lors de la récupération des données.');
        }
    }, [resetSelections]);

    const toggleCategory = async (key: DatasetKey) => {
        if (!base) return;
        const current = datasets[key];
        const nextChecked = !current.checked;

        setDatasets(prev => {
            const updated: Record<DatasetKey, DatasetState> = { ...prev } as any;
            (Object.keys(updated) as DatasetKey[]).forEach(k => {
                if (k === key) {
                    updated[k] = { ...updated[k], checked: nextChecked, error: null };
                } else {
                    updated[k] = { ...updated[k], checked: false, isoLoading: false };
                }
            });
            return updated;
        });

        if (!nextChecked) return;

        setDatasets(prev => ({
            ...prev,
            [key]: { ...prev[key], loading: prev[key].items.length === 0, isoLoading: true, error: null }
        }));

        try {
            let items = current.items;
            if (items.length === 0) {
                items = await closestObjectsToBase(base, key) as GeojsonFetchResponse[];
            }
            const colors = current.colors.length === items.length && current.colors.length > 0
                ? current.colors
                : generateColors(items.length);
            const dominant = colors[0] ?? '#22d3ee';
            const isochrone = computeIsochrone(base, items.map(i => i.coordinates), { paddingKm: 1 });
            setDatasets(prev => ({
                ...prev,
                [key]: {
                    ...prev[key],
                    loading: false,
                    isoLoading: false,
                    items,
                    colors,
                    color: dominant,
                    isochrone
                }
            }));
        } catch (e: any) {
            setDatasets(prev => ({
                ...prev,
                [key]: { ...prev[key], loading: false, isoLoading: false, error: e?.message ?? 'Erreur de chargement' }
            }));
        }
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
            .filter(k => datasets[k].checked)
            .flatMap(k => datasets[k].items.map((item, idx) => ({
                position: [item.coordinates.latitude, item.coordinates.longitude] as [number, number],
                color: datasets[k].colors[idx] ?? randomColor()
            })));
    }, [datasets]);

    const isochroneFeatures = useMemo(() => {
        return (Object.keys(datasets) as DatasetKey[])
            .filter(k => datasets[k].checked && datasets[k].isochrone)
            .map(k => ({
                type: 'Feature',
                properties: { category: k, color: datasets[k].color ?? '#f97316' },
                geometry: datasets[k].isochrone!
            }) as GeoJSONType.Feature);
    }, [datasets]);

    return (
        <div className="app">
            <div className="map-pane">
                <MapView
                    base={base}
                    communeFeature={communeFeature}
                    isochroneFeatures={isochroneFeatures}
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
                onToggleCategory={toggleCategory}
            />
        </div>
    );
}

export default App;
