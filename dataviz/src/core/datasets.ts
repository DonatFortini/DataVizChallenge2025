import type { QueryObject } from './types';

export type DatasetItem = QueryObject & {
    properties?: Record<string, unknown>;
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

