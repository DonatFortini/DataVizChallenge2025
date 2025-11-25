import type { DatasetKey, DatasetState } from '../core/datasets';
import { labelMap } from '../core/datasets';
import { ObjectKeyfromObj, type QueryObject } from '../core/types';

type DatasetSectionProps = {
    datasetKey: DatasetKey;
    data: DatasetState;
    hasBase: boolean;
    onSelectCategory: (key: DatasetKey, category: string) => void;
    onToggleItem: (key: DatasetKey, item: QueryObject) => void;
};

export function SelectionSection({ datasetKey, data, hasBase, onSelectCategory, onToggleItem }: DatasetSectionProps) {
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
