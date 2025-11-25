import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Point, type Commune, type QueryObject } from '../core/types';
import type { DatasetKey, DatasetState } from '../core/datasets';
import { roadDistanceBetween } from '../core/distance';
import type { MarkerInfo } from './MapView';
import { closestTo } from '../core/engine';
import { HeatmapSection } from './HeatmapSection';
import { SelectionSection } from './SelectionSection';
import { PARCOURS_CONFIG, PARCOURS_STEPS, type ParcoursResult, type ParcoursStepKey, ProfilSection, getAccessibilityLevel } from './ProfilSection';

type ActiveTab = 'selection' | 'heatmap' | 'profil';
const SPEED_KMH = 40;

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
    onProfilMarkersChange: (markers: MarkerInfo[]) => void;
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
    onHeatmapCategoryChange,
    onProfilMarkersChange
}: SidebarProps) {
    const headerText = activeTab === 'selection'
        ? 'Cliquez sur la carte pour sélectionner un point.'
        : activeTab === 'heatmap'
            ? 'Mode heatmap : choisissez un jeu de données et une catégorie. Les clics sur la carte sont désactivés.'
            : 'Parcours d’opportunités : suivez chaque étape de vie et ajoutez vos besoins.';

    const buildEmptyExtras = () => ({
        enfance: { etude: [] as string[], sante: [] as string[], sport: [] as string[] },
        adolescence: { etude: [] as string[], sante: [] as string[], sport: [] as string[] },
        adulte: { etude: [] as string[], sante: [] as string[], sport: [] as string[] }
    });

    const buildEmptySelection = () => ({
        enfance: { etude: '', sante: '', sport: '' },
        adolescence: { etude: '', sante: '', sport: '' },
        adulte: { etude: '', sante: '', sport: '' }
    });

    const [extraNeeds, setExtraNeeds] = useState(buildEmptyExtras);
    const [selectionDraft, setSelectionDraft] = useState(buildEmptySelection);
    const [parcoursResults, setParcoursResults] = useState<ParcoursResult[]>([]);
    const [profilLoading, setProfilLoading] = useState(false);
    const [profilError, setProfilError] = useState<string | null>(null);
    const [profilNeedsDirty, setProfilNeedsDirty] = useState(true);
    const lastRunRef = useRef(0);

    const categoriesByDomain: Record<DatasetKey, readonly string[]> = useMemo(() => ({
        etude: heatmapCategories.etude?.length ? heatmapCategories.etude : datasets.etude.categories,
        sante: heatmapCategories.sante?.length ? heatmapCategories.sante : datasets.sante.categories,
        sport: heatmapCategories.sport?.length ? heatmapCategories.sport : datasets.sport.categories
    }), [datasets, heatmapCategories]);

    const allNeeds = useMemo(() => {
        const needs: Array<{ step: ParcoursStepKey; domain: DatasetKey; category: string }> = [];
        PARCOURS_STEPS.forEach(step => {
            const cfg = PARCOURS_CONFIG[step];
            (['etude', 'sante', 'sport'] as DatasetKey[]).forEach(domain => {
                const baseCats = cfg[domain];
                const extras = extraNeeds[step][domain];
                const merged = Array.from(new Set([...baseCats, ...extras]));
                merged.forEach(cat => needs.push({ step, domain, category: cat }));
            });
        });
        return needs;
    }, [extraNeeds]);

    useEffect(() => {
        if (!hasBase || !basePoint || !commune) {
            setParcoursResults([]);
            onProfilMarkersChange([]);
            setProfilLoading(false);
            setProfilError(null);
            setProfilNeedsDirty(true);
        } else {
            setProfilNeedsDirty(true);
        }
    }, [basePoint, commune, hasBase, onProfilMarkersChange]);

    useEffect(() => {
        setProfilNeedsDirty(true);
    }, [allNeeds]);

    const runProfilAnalysis = useCallback(async () => {
        if (!hasBase || !basePoint || !commune) return;
        const runId = ++lastRunRef.current;
        setProfilLoading(true);
        setProfilError(null);
        setProfilNeedsDirty(false);
        try {
            const tasks = allNeeds.map(async need => {
                let best: QueryObject | null = null;
                try {
                    const list = await closestTo(basePoint, commune, need.domain, need.category);
                    best = list[0] ?? null;
                } catch {
                    best = null;
                }
                let minutes: number | null = null;
                if (best) {
                    try {
                        const target = new Point(best.coordonnees);
                        const { distanceKm } = await roadDistanceBetween(basePoint, target);
                        const safeKm = distanceKm >= 100000 ? null : distanceKm;
                        minutes = safeKm != null ? Math.round((safeKm / SPEED_KMH) * 60) : null;
                    } catch {
                        minutes = null;
                    }
                }
                const accessibility = minutes != null ? getAccessibilityLevel(minutes) : null;
                return {
                    step: need.step,
                    domain: need.domain,
                    category: need.category,
                    item: best,
                    minutes,
                    accessibility
                } as ParcoursResult;
            });
            const results = await Promise.all(tasks);
            if (lastRunRef.current === runId) {
                setParcoursResults(results);
                const markers: MarkerInfo[] = results
                    .filter(r => r.item)
                    .map(r => {
                        const [lon, lat] = (r.item as QueryObject).coordonnees;
                        const color = r.domain === 'etude' ? '#22c55e' : r.domain === 'sante' ? '#ef4444' : '#06b6d4';
                        const stepLabel = PARCOURS_CONFIG[r.step].label;
                        const domainLabel = r.domain === 'etude' ? 'Éducation' : r.domain === 'sante' ? 'Santé' : 'Sport';
                        return {
                            position: [lat, lon],
                            color,
                            label: `${stepLabel} • ${domainLabel} • ${r.category}${r.item?.commune ? ` — ${r.item.commune}` : ''}`
                        };
                    });
                onProfilMarkersChange(markers);
            }
        } catch (e: any) {
            if (lastRunRef.current === runId) {
                setProfilError(e?.message ?? 'Erreur lors du calcul du parcours.');
            }
        } finally {
            if (lastRunRef.current === runId) {
                setProfilLoading(false);
            }
        }
    }, [allNeeds, basePoint, commune, hasBase, onProfilMarkersChange]);

    const accessibilityCounts = useMemo(() => {
        return parcoursResults.reduce(
            (acc, r) => {
                const code = r.accessibility?.icon;
                if (code === '🟢') acc.good += 1;
                else if (code === '🟠') acc.medium += 1;
                else if (code === '🔴') acc.bad += 1;
                return acc;
            },
            { good: 0, medium: 0, bad: 0 }
        );
    }, [parcoursResults]);
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
                    className={activeTab === 'heatmap' ? 'tab active' : 'tab'}
                    onClick={() => onTabChange('heatmap')}
                >
                    Heatmap
                </button>
                <button
                    className={activeTab === 'selection' ? 'tab active' : 'tab'}
                    onClick={() => onTabChange('selection')}
                >
                    Sélections
                </button>
                <button
                    className={activeTab === 'profil' ? 'tab active' : 'tab'}
                    onClick={() => onTabChange('profil')}
                >
                    Parcours d&apos;opportunités
                </button>
            </div>

            {error && <div className="alert error">{error}</div>}
            {status && <div className="alert info">{status}</div>}
            {activeTab === 'heatmap' && heatmapError && <div className="alert error">{heatmapError}</div>}
            {commune && <CommuneCard commune={commune} />}

            {activeTab === 'selection' && (
                <div className="sections">
                    {(Object.keys(datasets) as DatasetKey[]).map(key => (
                        <SelectionSection
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
                    extraNeeds={extraNeeds}
                    selectionDraft={selectionDraft}
                    categoriesByDomain={categoriesByDomain}
                    results={parcoursResults}
                    loading={profilLoading}
                    counts={accessibilityCounts}
                    error={profilError}
                    needsDirty={profilNeedsDirty}
                    canRun={Boolean(activeTab === 'profil' && hasBase && basePoint && commune)}
                    onRunAnalysis={runProfilAnalysis}
                    onDraftChange={(step, domain, value) => {
                        setSelectionDraft(prev => ({
                            ...prev,
                            [step]: { ...prev[step], [domain]: value }
                        }));
                    }}
                    onAddExtra={(step, domain) => {
                        const value = selectionDraft[step][domain];
                        if (!value) return;
                        const already = new Set([...PARCOURS_CONFIG[step][domain], ...(extraNeeds[step][domain] ?? [])]);
                        if (already.has(value)) return;
                        setExtraNeeds(prev => ({
                            ...prev,
                            [step]: { ...prev[step], [domain]: [...prev[step][domain], value] }
                        }));
                        setSelectionDraft(prev => ({
                            ...prev,
                            [step]: { ...prev[step], [domain]: '' }
                        }));
                    }}
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
