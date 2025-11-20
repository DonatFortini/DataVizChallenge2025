import type * as GeoJSONType from 'geojson';

import type { GeojsonFetchResponse } from './types';

export type DatasetKey = 'etude' | 'sante' | 'sport';

export type DatasetState = {
    checked: boolean;
    loading: boolean;
    isoLoading: boolean;
    items: GeojsonFetchResponse[];
    colors: string[];
    isochrone?: GeoJSONType.Polygon;
    color?: string;
    error?: string | null;
};

export const labelMap: Record<DatasetKey, string> = {
    etude: 'Scolaire',
    sante: 'Santé',
    sport: 'Sport'
};

export const initialDatasetState = (): Record<DatasetKey, DatasetState> => ({
    etude: { checked: false, loading: false, isoLoading: false, items: [], colors: [], isochrone: undefined, error: null },
    sante: { checked: false, loading: false, isoLoading: false, items: [], colors: [], isochrone: undefined, error: null },
    sport: { checked: false, loading: false, isoLoading: false, items: [], colors: [], isochrone: undefined, error: null }
});
