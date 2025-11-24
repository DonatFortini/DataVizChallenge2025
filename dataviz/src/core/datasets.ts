import type { QueryObject } from './types';

export type DatasetItem = QueryObject & {
    properties?: Record<string, unknown>;
    wgs?: [number, number];
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

export const datasetItemKey = (item: DatasetItem): string => {
    if (item.wgs) {
        const [lat, lon] = item.wgs;
        return `${item.nom ?? 'item'}:${lat.toFixed(5)},${lon.toFixed(5)}`;
    }
    if (item.geometry?.type === 'Point' && Array.isArray(item.geometry.coordinates)) {
        return JSON.stringify(item.geometry.coordinates);
    }
    return (item.nom ?? 'item') + (item.commune ?? '');
};
