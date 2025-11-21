import type { Commune, GeojsonFetchResponse } from '../core/types';
import type { DatasetKey, DatasetState } from '../core/datasets';
import { labelMap } from '../core/datasets';
import { featureKey } from '../core/engine';

type SidebarProps = {
    baseLambert: { x: number; y: number } | null;
    error: string | null;
    status: string | null;
    commune: Commune | null;
    datasets: Record<DatasetKey, DatasetState>;
    hasBase: boolean;
    activeTab: 'selection' | 'heatmap';
    onTabChange: (tab: 'selection' | 'heatmap') => void;
    heatSelection: { dataset: DatasetKey; category: string };
    heatCategories: string[];
    heatLoading: boolean;
    heatError: string | null;
    heatPointCount: number;
    onChangeHeatDataset: (dataset: DatasetKey) => void;
    onChangeHeatCategory: (category: string) => void;
    onSelectCategory: (key: DatasetKey, category: string) => void;
    onToggleItem: (key: DatasetKey, item: GeojsonFetchResponse) => void;
    onGenerateIsochrone: () => void | Promise<void>;
    canGenerate: boolean;
    selectionCount: number;
};

export function Sidebar({
    baseLambert,
    error,
    status,
    commune,
    datasets,
    hasBase,
    activeTab,
    onTabChange,
    heatSelection,
    heatCategories,
    heatLoading,
    heatError,
    heatPointCount,
    onChangeHeatDataset,
    onChangeHeatCategory,
    onSelectCategory,
    onToggleItem,
    onGenerateIsochrone,
    canGenerate,
    selectionCount
}: SidebarProps) {
    return (
        <div className="sidebar">
            <header>
                <h1>Carte de la vie en Corse</h1>
                <p>Cliquez sur la carte pour sélectionner un point.</p>
                {baseLambert && (
                    <p className="small">Lambert: x {baseLambert.x.toFixed(0)} | y {baseLambert.y.toFixed(0)}</p>
                )}
            </header>

            <div className="tabs">
                <button
                    className={activeTab === 'selection' ? 'tab active' : 'tab'}
                    onClick={() => onTabChange('selection')}
                >
                    Sélections
                </button>
                <button
                    className={activeTab === 'heatmap' ? 'tab active' : 'tab'}
                    onClick={() => onTabChange('heatmap')}
                >
                    Heatmap
                </button>
            </div>

            {error && <div className="alert error">{error}</div>}
            {status && <div className="alert info">{status}</div>}
            {commune && <CommuneCard commune={commune} />}

            {activeTab === 'selection' ? (
                <>
                    <div className="sections">
                        {(Object.keys(datasets) as DatasetKey[]).map(key => (
                            <DatasetSection
                                key={key}
                                datasetKey={key}
                                data={datasets[key]}
                                hasBase={hasBase}
                                onSelectCategory={onSelectCategory}
                                onToggleItem={onToggleItem}
                            />
                        ))}
                    </div>
                    <div className="section">
                        <button
                            className="btn full"
                            onClick={onGenerateIsochrone}
                            disabled={!canGenerate}
                        >
                            Générer la carte ({selectionCount} sélectionnés)
                        </button>
                    </div>
                </>
            ) : (
                <HeatmapSection
                    hasBase={hasBase}
                    selection={heatSelection}
                    categories={heatCategories}
                    loading={heatLoading}
                    error={heatError}
                    count={heatPointCount}
                    onChangeDataset={onChangeHeatDataset}
                    onChangeCategory={onChangeHeatCategory}
                />
            )}
            <footer className="footer">
                <span>Théo N&apos;Guyen et Donat Fortini — 2025 challenge dataviz</span>
            </footer>
        </div>
    );
}

function CommuneCard({ commune }: { commune: Commune }) {
    return (
        <div className="commune-card">
            <h2>{commune.properties?.nom ?? (commune.properties as any)?.nom_commune ?? 'Commune'}</h2>
            <p className="muted">Commune sélectionnée : {commune.properties?.nom ?? 'N/A'}</p>
        </div>
    );
}

type HeatmapSectionProps = {
    hasBase: boolean;
    selection: { dataset: DatasetKey; category: string };
    categories: string[];
    loading: boolean;
    error: string | null;
    count: number;
    onChangeDataset: (dataset: DatasetKey) => void;
    onChangeCategory: (category: string) => void;
};

function HeatmapSection({
    hasBase,
    selection,
    categories,
    loading,
    error,
    count,
    onChangeDataset,
    onChangeCategory
}: HeatmapSectionProps) {
    const categoryOptions = ['all', ...categories];
    return (
        <div className="section">
            <div className="section-header">
                <div className="section-title">
                    <span>Heatmap par distance</span>
                    <p className="small">Visualiser toutes les occurrences d&apos;une catégorie.</p>
                </div>
                <span className={`pill ${hasBase ? 'success' : 'muted'}`}>
                    {hasBase ? 'Point prêt' : 'Attente d\'un point'}
                </span>
            </div>
            <div className="section-body">
                <label className="field-label">Type d&apos;objet</label>
                <select
                    value={selection.dataset}
                    onChange={e => onChangeDataset(e.target.value as DatasetKey)}
                    disabled={loading}
                >
                    {(Object.keys(labelMap) as DatasetKey[]).map(key => (
                        <option key={key} value={key}>{labelMap[key]}</option>
                    ))}
                </select>

                <label className="field-label">Catégorie</label>
                <select
                    value={selection.category}
                    onChange={e => onChangeCategory(e.target.value)}
                    disabled={loading || categoryOptions.length === 0}
                >
                    {categoryOptions.map(cat => (
                        <option key={cat} value={cat}>
                            {cat === 'all' ? 'Toutes les catégories' : cat}
                        </option>
                    ))}
                </select>

                {!hasBase && <p className="small">Sélectionnez un point sur la carte pour calculer la heatmap.</p>}
                {loading && <p className="small">Calcul de la heatmap...</p>}
                {error && <p className="small error-text">{error}</p>}
                {hasBase && !loading && !error && (
                    <p className="small">{count > 0 ? `${count} objets pris en compte.` : 'Aucun objet pour cette catégorie.'}</p>
                )}
            </div>
        </div>
    );
}

type DatasetSectionProps = {
    datasetKey: DatasetKey;
    data: DatasetState;
    hasBase: boolean;
    onSelectCategory: (key: DatasetKey, category: string) => void;
    onToggleItem: (key: DatasetKey, item: GeojsonFetchResponse) => void;
};

function DatasetSection({ datasetKey, data, hasBase, onSelectCategory, onToggleItem }: DatasetSectionProps) {
    const categories = ['all', ...data.categories];
    return (
        <div className="section">
            <div className="section-header">
                <span>{labelMap[datasetKey]}</span>
                <select
                    value={data.selectedCategory}
                    onChange={(e) => onSelectCategory(datasetKey, e.target.value)}
                    disabled={!hasBase || data.loading}
                >
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat === 'all' ? 'Toutes les catégories' : cat}</option>
                    ))}
                </select>
            </div>
            <div className="section-body">
                {!hasBase && <p className="small">Cliquez sur la carte pour commencer.</p>}
                {hasBase && data.loading && <p className="small">Chargement...</p>}
                {hasBase && data.error && <p className="small error-text">{data.error}</p>}
                {hasBase && !data.loading && data.items.length === 0 && <p className="small">Aucun objet trouvé.</p>}
                <ul>
                    {data.items.map((item, idx) => {
                        const props: any = item.properties ?? {};
                        const communeName = props.commune ?? props.nom_commune;
                        const title = props.nom ?? communeName ?? 'Objet';
                        const subtitle = props.categorie ?? props.profession;
                        const key = featureKey(item);
                        const selected = Boolean(data.selectedItems[key]);
                        const color = data.selectedColors[key] ?? data.colors[idx] ?? '#22c55e';
                        return (
                            <li key={key} className="list-item">
                                <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => onToggleItem(datasetKey, item)}
                                    disabled={!hasBase}
                                />
                                <span className="color-dot" style={{ background: color }} />
                                <div className="list-text">
                                    <strong>{title}</strong>
                                    {subtitle && (
                                        <div className="muted">{subtitle}</div>
                                    )}
                                    {communeName && (
                                        <span className="muted"> — {communeName}</span>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
