import { useEffect, useMemo, useState } from 'react';
import { ObjectKeyfromObj, Point, type Commune, type QueryObject } from '../core/types';
import type { DatasetKey, DatasetState } from '../core/datasets';
import { labelMap } from '../core/datasets';
import { roadDistanceBetween } from '../core/distance';

type ActiveTab = 'selection' | 'heatmap' | 'profil';
type AccessLevel = { label: string; color: string; icon: string };
type NeedOption = { id: string; label: string; dataset: DatasetKey; category: string; domain: 'education' | 'sante' | 'sport' };
type NeedResult = {
    need: NeedOption;
    item: QueryObject | null;
    minutes: number | null;
    accessibility: AccessLevel | null;
};

const SPEED_KMH = 40;

const NEED_OPTIONS: NeedOption[] = [
    { id: 'edu-maternelle', label: 'École maternelle', dataset: 'etude', category: 'ECOLE MATERNELLE', domain: 'education' },
    { id: 'edu-primaire', label: 'École primaire', dataset: 'etude', category: 'ECOLE ELEMENTAIRE', domain: 'education' },
    { id: 'edu-college', label: 'Collège', dataset: 'etude', category: 'COLLEGE', domain: 'education' },
    { id: 'edu-lycee', label: 'Lycée', dataset: 'etude', category: 'LYCEE', domain: 'education' },
    { id: 'sante-generaliste', label: 'Médecin généraliste', dataset: 'sante', category: 'Médecin généraliste', domain: 'sante' },
    { id: 'sante-pediatre', label: 'Pédiatre', dataset: 'sante', category: 'Pédiatre', domain: 'sante' },
    { id: 'sante-gyneco', label: 'Gynécologue', dataset: 'sante', category: 'Gynécologue médical', domain: 'sante' },
    { id: 'sport-multisport', label: 'City-stade / multisport', dataset: 'sport', category: 'Plateau EPS/Multisports/city-stades', domain: 'sport' },
    { id: 'sport-foot', label: 'Terrain de football', dataset: 'sport', category: 'Terrain de football', domain: 'sport' },
    { id: 'sport-randonnee', label: 'Boucle de randonnée', dataset: 'sport', category: 'Boucle de randonnée', domain: 'sport' }
];

function accessibilityLevel(minutes: number): AccessLevel {
    if (minutes < 15) return { label: 'Bon accès', color: 'green', icon: '🟢' };
    if (minutes <= 30) return { label: 'Accès moyen', color: 'orange', icon: '🟠' };
    return { label: 'Accès difficile', color: 'red', icon: '🔴' };
}

function formatMinutes(minutes: number | null): string {
    if (minutes == null || !Number.isFinite(minutes)) return 'N/A';
    return `${minutes} min`;
}

type SidebarProps = {
    baseLambert: { x: number; y: number } | null;
    error: string | null;
    status: string | null;
    basePoint: Point | null;
    commune: Commune | null;
    datasets: Record<DatasetKey, DatasetState>;
    hasBase: boolean;
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
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
    basePoint,
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
        : activeTab === 'heatmap'
            ? 'Mode heatmap : choisissez un jeu de données et une catégorie. Les clics sur la carte sont désactivés.'
            : 'Profil d’opportunités : cochez vos besoins pour estimer l’accessibilité.';

    const [selectedNeeds, setSelectedNeeds] = useState<string[]>(['edu-primaire', 'sante-generaliste', 'sport-multisport']);
    const [profilResults, setProfilResults] = useState<NeedResult[]>([]);
    const [profilLoading, setProfilLoading] = useState(false);

    const groupedNeeds = useMemo(() => ({
        education: NEED_OPTIONS.filter(n => n.domain === 'education'),
        sante: NEED_OPTIONS.filter(n => n.domain === 'sante'),
        sport: NEED_OPTIONS.filter(n => n.domain === 'sport')
    }), []);

    useEffect(() => {
        if (activeTab !== 'profil') return;
        if (!hasBase || !basePoint) {
            setProfilResults([]);
            return;
        }

        const selectedOptions = NEED_OPTIONS.filter(n => selectedNeeds.includes(n.id));
        if (selectedOptions.length === 0) {
            setProfilResults([]);
            return;
        }

        let cancelled = false;
        const compute = async () => {
            setProfilLoading(true);
            try {
                const results: NeedResult[] = [];

                for (const need of selectedOptions) {
                    const dataset = datasets[need.dataset];
                    const candidates = dataset.items.filter(item =>
                        (item.categorie ?? '').toLowerCase() === need.category.toLowerCase()
                    );
                    const best = candidates[0] ?? dataset.items[0] ?? null;
                    let minutes: number | null = null;

                    if (best && basePoint) {
                        try {
                            const target = new Point(best.coordonnees);
                            const { distanceKm } = await roadDistanceBetween(basePoint, target);
                            const safeKm = distanceKm >= 100000 ? null : distanceKm; // ignore fallback absurd values
                            minutes = safeKm != null ? Math.round((safeKm / SPEED_KMH) * 60) : null;
                        } catch (err) {
                            minutes = null;
                        }
                    }

                    const accessibility = minutes != null ? accessibilityLevel(minutes) : null;
                    results.push({ need, item: best, minutes, accessibility });
                }

                if (!cancelled) {
                    setProfilResults(results);
                }
            } finally {
                if (!cancelled) {
                    setProfilLoading(false);
                }
            }
        };

        compute();
        return () => { cancelled = true; };
    }, [activeTab, basePoint, datasets, hasBase, selectedNeeds]);

    const toggleNeed = (id: string) => {
        setSelectedNeeds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const accessibilityCounts = useMemo(() => {
        return profilResults.reduce(
            (acc, r) => {
                const code = r.accessibility?.icon;
                if (code === '🟢') acc.good += 1;
                else if (code === '🟠') acc.medium += 1;
                else if (code === '🔴') acc.bad += 1;
                return acc;
            },
            { good: 0, medium: 0, bad: 0 }
        );
    }, [profilResults]);
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
                <button
                    className={activeTab === 'profil' ? 'tab active' : 'tab'}
                    onClick={() => onTabChange('profil')}
                >
                    Profil d&apos;opportunités
                </button>
            </div>

            {error && <div className="alert error">{error}</div>}
            {status && <div className="alert info">{status}</div>}
            {activeTab === 'heatmap' && heatmapError && <div className="alert error">{heatmapError}</div>}
            {commune && <CommuneCard commune={commune} />}

            {activeTab === 'selection' && (
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
            )}

            {activeTab === 'heatmap' && (
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

            {activeTab === 'profil' && (
                <ProfilSection
                    basePoint={basePoint}
                    commune={commune}
                    hasBase={hasBase}
                    groupedNeeds={groupedNeeds}
                    selectedNeeds={selectedNeeds}
                    results={profilResults}
                    loading={profilLoading}
                    counts={accessibilityCounts}
                    onToggleNeed={toggleNeed}
                />
            )}
            <footer className="footer">
                <span>Théo N&apos;Guyen et Donat Fortini — 2025 challenge dataviz</span>
            </footer>
        </div>
    );
}

function ProfilSection({
    basePoint,
    commune,
    hasBase,
    groupedNeeds,
    selectedNeeds,
    results,
    counts,
    loading,
    onToggleNeed
}: {
    basePoint: Point | null;
    commune: Commune | null;
    hasBase: boolean;
    groupedNeeds: { education: NeedOption[]; sante: NeedOption[]; sport: NeedOption[] };
    selectedNeeds: string[];
    results: NeedResult[];
    counts: { good: number; medium: number; bad: number };
    loading: boolean;
    onToggleNeed: (id: string) => void;
}) {
    const coordText = basePoint ? `${basePoint.latitude.toFixed(4)}, ${basePoint.longitude.toFixed(4)}` : null;
    const hasSelection = selectedNeeds.length > 0;

    const domains = {
        education: 'éducation',
        sante: 'santé',
        sport: 'sport'
    };

    const domainStatus = useMemo(() => {
        const status: Record<string, Set<string>> = {};
        for (const [key] of Object.entries(domains)) {
            status[key] = new Set<string>();
        }
        for (const r of results) {
            if (r.accessibility?.icon) {
                status[r.need.domain].add(r.accessibility.icon);
            }
        }
        return status;
    }, [results]);

    const summarize = () => {
        if (!hasSelection) return 'Sélectionnez au moins un besoin pour construire votre profil.';
        if (!hasBase) return 'Choisissez un point sur la carte pour estimer les distances.';
        if (results.length === 0) return 'Aucun service trouvé pour ces besoins.';
        const makeList = (keys: string[]) => keys
            .map(k => domains[k as keyof typeof domains])
            .filter(Boolean)
            .join(' et ');
        const goodDomains = Object.entries(domainStatus)
            .filter(([, set]) => set.has('🟢'))
            .map(([k]) => k);
        const mediumDomains = Object.entries(domainStatus)
            .filter(([, set]) => set.has('🟠') && !set.has('🔴'))
            .map(([k]) => k);
        const badDomains = Object.entries(domainStatus)
            .filter(([, set]) => set.has('🔴'))
            .map(([k]) => k);

        const phrases: string[] = [];
        if (goodDomains.length) phrases.push(`bon accès pour ${makeList(goodDomains)}`);
        if (mediumDomains.length) phrases.push(`accès moyen en ${makeList(mediumDomains)}`);
        if (badDomains.length) phrases.push(`trajets longs pour ${makeList(badDomains)}`);

        return `🟢 ${counts.good} • 🟠 ${counts.medium} • 🔴 ${counts.bad} — ${phrases.join(', ') || 'profil équilibré.'}`;
    };

    const renderNeedGroup = (title: string, options: NeedOption[]) => (
        <div className="need-group">
            <div className="field-label">{title}</div>
            <div className="needs-grid">
                {options.map(opt => (
                    <label key={opt.id} className="need-item">
                        <input
                            type="checkbox"
                            checked={selectedNeeds.includes(opt.id)}
                            onChange={() => onToggleNeed(opt.id)}
                        />
                        <span>{opt.label}</span>
                    </label>
                ))}
            </div>
        </div>
    );

    return (
        <div className="sections">
            <div className="section">
                <div className="section-header">
                    <span>Vos besoins</span>
                </div>
                <div className="section-body">
                    <p className="small muted">Cochez les services à analyser autour du point choisi.</p>
                    {renderNeedGroup('Éducation', groupedNeeds.education)}
                    {renderNeedGroup('Santé', groupedNeeds.sante)}
                    {renderNeedGroup('Sport', groupedNeeds.sport)}
                </div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span>Profil d&apos;opportunités</span>
                </div>
                <div className="section-body">
                    {commune && (
                        <p className="small">Commune : {commune.name}</p>
                    )}
                    {coordText && <p className="small muted">Coordonnées : {coordText}</p>}
                    {!hasBase && <p className="small">Sélectionnez un point sur la carte pour lancer l’analyse.</p>}
                    {hasBase && !hasSelection && <p className="small">Choisissez au moins un besoin.</p>}
                    {loading && <p className="small">Analyse en cours...</p>}

                    {hasBase && hasSelection && !loading && results.length > 0 && (
                        <div className="profil-table">
                            <div className="profil-row profil-head">
                                <span>Besoin</span>
                                <span>Service trouvé</span>
                                <span>Estimation</span>
                                <span>Accessibilité</span>
                            </div>
                            {results.map(result => {
                                const serviceLabel = result.item
                                    ? `${result.item.nom}${result.item.commune ? ` — ${result.item.commune}` : ''}`
                                    : 'Aucun service';
                                return (
                                    <div className="profil-row" key={result.need.id}>
                                        <span>{result.need.label}</span>
                                        <span>{serviceLabel}</span>
                                        <span>{formatMinutes(result.minutes)}</span>
                                        <span>
                                            {result.accessibility
                                                ? <span className="profil-chip" style={{ color: result.accessibility.color }}>
                                                    {result.accessibility.icon} {result.accessibility.label}
                                                </span>
                                                : <span className="profil-chip muted">Non évalué</span>
                                            }
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {hasBase && hasSelection && !loading && results.length === 0 && (
                        <p className="small">Aucun service trouvé pour ces besoins.</p>
                    )}

                    <div className="profil-summary">
                        <div className="profil-counts">
                            <span>🟢 {counts.good}</span>
                            <span>🟠 {counts.medium}</span>
                            <span>🔴 {counts.bad}</span>
                        </div>
                        <p className="small muted">{summarize()}</p>
                    </div>
                </div>
            </div>
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
