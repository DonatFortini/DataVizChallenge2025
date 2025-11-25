import { ObjectKeyfromObj, type Commune, type QueryObject } from '../core/types';
import type { DatasetKey, DatasetState } from '../core/datasets';
import { labelMap } from '../core/datasets';


type SidebarProps = {
    baseLambert: { x: number; y: number } | null;
    error: string | null;
    status: string | null;
    commune: Commune | null;
    datasets: Record<DatasetKey, DatasetState>;
    hasBase: boolean;
    activeTab: 'selection' | 'heatmap';
    onTabChange: (tab: 'selection' | 'heatmap') => void;
    onSelectCategory: (key: DatasetKey, category: string) => void;
    onToggleItem: (key: DatasetKey, item: QueryObject) => void;
    selectionCount: number;
    heatmapDataset: DatasetKey;
    heatmapCategory: string;
    heatmapCategories: Record<DatasetKey, string[]>;
    heatmapLoading: boolean;
    heatmapError: string | null;
    onHeatmapDatasetChange: (dataset: DatasetKey) => void;
    onHeatmapCategoryChange: (category: string) => void;
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
    onSelectCategory,
    onToggleItem,
    selectionCount,
    heatmapDataset,
    heatmapCategory,
    heatmapCategories,
    heatmapLoading,
    heatmapError,
    onHeatmapDatasetChange,
    onHeatmapCategoryChange
}: SidebarProps) {
    const headerText = activeTab === 'selection'
        ? 'Cliquez sur la carte pour sélectionner un point.'
        : 'Mode heatmap : choisissez un jeu de données et une catégorie. Les clics sur la carte sont désactivés.';
    return (
        <div className="sidebar">
            <header>
                <h1>Carte de la vie en Corse</h1>
                <p>{headerText}</p>
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
            {activeTab === 'heatmap' && heatmapError && <div className="alert error">{heatmapError}</div>}
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
                </>
            ) : (
                <HeatmapSection
                    dataset={heatmapDataset}
                    category={heatmapCategory}
                    categories={heatmapCategories[heatmapDataset] ?? []}
                    loading={heatmapLoading}
                    selectionCount={selectionCount}
                    onDatasetChange={onHeatmapDatasetChange}
                    onCategoryChange={onHeatmapCategoryChange}
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
            <h2>{commune.name ?? 'Commune'}</h2>
            <p className="muted">Commune sélectionnée : {commune.name ?? 'N/A'}</p>
        </div>
    );
}

function HeatmapSection({
    dataset,
    category,
    categories,
    loading,
    onDatasetChange,
    onCategoryChange
}: {
    dataset: DatasetKey;
    category: string;
    categories: string[];
    loading: boolean;
    selectionCount: number;
    onDatasetChange: (dataset: DatasetKey) => void;
    onCategoryChange: (category: string) => void;
}) {
    const categoryOptions = ['all', ...(categories ?? [])];
    return (
        <div className="section">
            <div className="section-header">
            </div>
            <div className="section-body">
                <label className="field-label">Jeu de données</label>
                <select value={dataset} onChange={e => onDatasetChange(e.target.value as DatasetKey)} disabled={loading}>
                    {(Object.keys(labelMap) as DatasetKey[]).map(key => (
                        <option key={key} value={key}>{labelMap[key]}</option>
                    ))}
                </select>

                <label className="field-label" style={{ marginTop: '0.6rem' }}>Catégorie</label>
                <select
                    value={category}
                    onChange={e => onCategoryChange(e.target.value)}
                    disabled={loading || categoryOptions.length === 1}
                >
                    {categoryOptions.map(cat => (
                        <option key={cat} value={cat}>{cat === 'all' ? 'Toutes les catégories' : cat}</option>
                    ))}
                </select>
                {loading
                    ? <p className="small">Calcul de la heatmap...</p>
                    : <p className="small muted">La carte colore chaque commune selon le nombre d&apos;objets trouvés.</p>
                }
            </div>
        </div>
    );
}

type DatasetSectionProps = {
    datasetKey: DatasetKey;
    data: DatasetState;
    hasBase: boolean;
    onSelectCategory: (key: DatasetKey, category: string) => void;
    onToggleItem: (key: DatasetKey, item: QueryObject) => void;
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
                        const communeName = item.commune;
                        const title = item.nom ?? communeName ?? 'Objet';
                        const subtitle = item.categorie;
                        const key = ObjectKeyfromObj(item);
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
