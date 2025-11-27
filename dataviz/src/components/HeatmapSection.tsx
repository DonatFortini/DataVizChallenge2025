import { DATASET_KEYS, formatCategoryLabel, labelMap, withAllCategory, type DatasetKey } from "../core/types";

type HeatmapSectionProps = {
    dataset: DatasetKey;
    category: string;
    categories: string[];
    loading: boolean;
    selectionCount: number;
    onDatasetChange: (dataset: DatasetKey) => void;
    onCategoryChange: (category: string) => void;
};

export function HeatmapSection({
    dataset,
    category,
    categories,
    loading,
    onDatasetChange,
    onCategoryChange
}: HeatmapSectionProps) {
    const categoryOptions = withAllCategory(categories ?? []);
    return (
        <div className="section">
            <div className="section-header">
            </div>
            <div className="section-body">
                <label className="field-label">Jeu de données</label>
                <select value={dataset} onChange={e => onDatasetChange(e.target.value as DatasetKey)} disabled={loading}>
                    {DATASET_KEYS.map(key => (
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
                        <option key={cat} value={cat}>{formatCategoryLabel(cat)}</option>
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
