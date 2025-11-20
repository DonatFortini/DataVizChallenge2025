import type { Commune } from '../core/types';
import type { DatasetKey, DatasetState } from '../core/datasets';
import { labelMap } from '../core/datasets';

type SidebarProps = {
    baseLambert: { x: number; y: number } | null;
    error: string | null;
    status: string | null;
    commune: Commune | null;
    datasets: Record<DatasetKey, DatasetState>;
    hasBase: boolean;
    onToggleCategory: (key: DatasetKey) => void;
};

export function Sidebar({ baseLambert, error, status, commune, datasets, hasBase, onToggleCategory }: SidebarProps) {
    return (
        <div className="sidebar">
            <header>
                <h1>Carte de la vie en Corse</h1>
                <p>Cliquez sur la carte pour sélectionner un point.</p>
                {baseLambert && (
                    <p className="small">Lambert: x {baseLambert.x.toFixed(0)} | y {baseLambert.y.toFixed(0)}</p>
                )}
            </header>

            {error && <div className="alert error">{error}</div>}
            {status && <div className="alert info">{status}</div>}
            {commune && <CommuneCard commune={commune} />}

            <div className="sections">
                {(Object.keys(datasets) as DatasetKey[]).map(key => (
                    <DatasetSection
                        key={key}
                        datasetKey={key}
                        data={datasets[key]}
                        hasBase={hasBase}
                        onToggle={onToggleCategory}
                    />
                ))}
            </div>
            <footer className="footer">
                <span>Théo N&apos;Guyen et Donat Fortini — 2025 challenge dataviz</span>
            </footer>
        </div>
    );
}

function CommuneCard({ commune }: { commune: Commune }) {
    return (
        <div className="commune-card">
            <h2>{(commune.properties as any)?.nom_commune ?? commune.properties?.nom ?? 'Commune'}</h2>
            <p className="muted">Commune sélectionnée : {(commune.properties as any)?.nom_commune ?? commune.properties?.nom ?? 'N/A'}</p>
        </div>
    );
}

type DatasetSectionProps = {
    datasetKey: DatasetKey;
    data: DatasetState;
    hasBase: boolean;
    onToggle: (key: DatasetKey) => void;
};

function DatasetSection({ datasetKey, data, hasBase, onToggle }: DatasetSectionProps) {
    return (
        <div className="section">
            <label className="section-header">
                <input
                    type="checkbox"
                    checked={data.checked}
                    onChange={() => onToggle(datasetKey)}
                    disabled={!hasBase}
                />
                <span>{labelMap[datasetKey]}</span>
            </label>
            {data.checked && (
                <div className="section-body">
                    {data.loading && <p className="small">Chargement...</p>}
                    {data.error && <p className="small error-text">{data.error}</p>}
                    {!data.loading && data.items.length === 0 && <p className="small">Aucun objet trouvé.</p>}
                    <ul>
                        {data.items.map((item, idx) => {
                            const props: any = item.properties ?? {};
                            const communeName = props.commune ?? props.nom_commune;
                            return (
                                <li key={idx} className="list-item">
                                    <span className="color-dot" style={{ background: data.colors[idx] ?? '#22c55e' }} />
                                    <div className="list-text">
                                        <strong>{props.nom ?? communeName ?? 'Objet'}</strong>
                                        {props.profession && (
                                            <div className="muted">{props.profession}</div>
                                        )}
                                        {communeName && (
                                            <span className="muted"> — {communeName}</span>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    {data.isoLoading && <p className="small">Calcul de l’isochrone...</p>}
                </div>
            )}
        </div>
    );
}
