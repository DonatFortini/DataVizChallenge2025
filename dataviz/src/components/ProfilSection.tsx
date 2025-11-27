import { useMemo, useState } from 'react';
import type { Commune, QueryObject, DatasetKey } from '../core/types';
import { Point } from '../core/types';
export type AccessLevel = { label: string; color: string; icon: string };
export type ParcoursStepKey = 'enfance' | 'adolescence' | 'adulte';
export type ParcoursResult = {
    step: ParcoursStepKey;
    domain: DatasetKey;
    category: string;
    item: QueryObject | null;
    minutes: number | null;
    accessibility: AccessLevel | null;
};

export const PARCOURS_CONFIG: Record<ParcoursStepKey, { label: string; etude: string[]; sante: string[]; sport: string[] }> = {
    enfance: {
        label: "Enfance",
        etude: ["ECOLE MATERNELLE", "ECOLE ELEMENTAIRE"],
        sante: ["Pédiatre", "Chirurgien-dentiste"],
        sport: ["Plateau EPS/Multisports/city-stades"]
    },
    adolescence: {
        label: "Adolescence",
        etude: ["COLLEGE", "LYCEE"],
        sante: ["Médecin généraliste", "Psychiatre"],
        sport: ["Terrain de football", "Salle multisports (gymnase)"]
    },
    adulte: {
        label: "Adulte",
        etude: ["UNIVERSITE"],
        sante: ["Cardiologue"],
        sport: ["Salle de musculation/cardiotraining", "Parcours sportif/santé"]
    }
};
export const PARCOURS_STEPS: ParcoursStepKey[] = ['enfance', 'adolescence', 'adulte'];
const DOMAIN_LABELS: Record<DatasetKey, string> = { etude: 'Éducation', sante: 'Santé', sport: 'Sport' };

function accessibilityLevel(minutes: number): AccessLevel {
    if (minutes < 15) return { label: 'Bon', color: 'green', icon: '🟢' };
    if (minutes <= 30) return { label: 'Moyen', color: 'orange', icon: '🟠' };
    return { label: 'Difficile', color: 'red', icon: '🔴' };
}

function formatMinutes(minutes: number | null): string {
    if (minutes == null || !Number.isFinite(minutes)) return 'N/A';
    return `${minutes} min`;
}

function computeGlobalScore(avgMinutes: number): number {
    const score = 100 - avgMinutes * 1.5;
    return Math.max(0, Math.min(100, Math.round(score)));
}

type ProfilSectionProps = {
    basePoint: Point | null;
    commune: Commune | null;
    hasBase: boolean;
    speedKmh: number;
    extraNeeds: Record<ParcoursStepKey, { etude: string[]; sante: string[]; sport: string[] }>;
    selectionDraft: Record<ParcoursStepKey, { etude: string; sante: string; sport: string }>;
    categoriesByDomain: Record<DatasetKey, readonly string[]>;
    results: ParcoursResult[];
    counts: { good: number; medium: number; bad: number };
    loading: boolean;
    error: string | null;
    needsDirty: boolean;
    canRun: boolean;
    onDraftChange: (step: ParcoursStepKey, domain: DatasetKey, value: string) => void;
    onAddExtra: (step: ParcoursStepKey, domain: DatasetKey) => void;
    onRunAnalysis: () => void;
};

export function ProfilSection({
    hasBase,
    speedKmh,
    extraNeeds,
    selectionDraft,
    categoriesByDomain,
    results,
    counts,
    loading,
    error,
    needsDirty,
    canRun,
    onDraftChange,
    onAddExtra,
    onRunAnalysis
}: ProfilSectionProps) {
    const [focusedStep, setFocusedStep] = useState<ParcoursStepKey>('enfance');
    const averageMinutes = useMemo(() => {
        const valid = results.map(r => r.minutes).filter((m): m is number => m != null && Number.isFinite(m));
        if (!valid.length) return null;
        const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
        return Math.round(avg);
    }, [results]);

    const globalScore = useMemo(() => {
        if (averageMinutes == null) return null;
        return computeGlobalScore(averageMinutes);
    }, [averageMinutes]);

    const summaryText = useMemo(() => {
        if (!hasBase) return 'Choisissez un point sur la carte pour estimer les distances.';
        if (!results.length) return 'Aucun service trouvé pour ces besoins.';
        if (globalScore == null) return 'Analyse en attente de données suffisantes.';
        if (globalScore >= 75) return 'Vous avez un bon accès global aux services essentiels.';
        if (globalScore >= 50) return 'Accès correct mais certaines opportunités peuvent demander des trajets plus longs.';
        return 'Plusieurs opportunités sont éloignées et peuvent limiter le quotidien.';
    }, [globalScore, hasBase, results.length]);

    const plannedNeeds = useMemo(() => {
        const config = PARCOURS_CONFIG[focusedStep];
        const items = (['etude', 'sante', 'sport'] as DatasetKey[])
            .flatMap(domain => config[domain].map(cat => `${DOMAIN_LABELS[domain]} — ${cat}`));
        const tooltip = items.length
            ? `Besoins pré-remplis :\n${items.join('\n')}`
            : 'Aucun besoin pré-rempli';
        return { count: items.length, tooltip, items };
    }, [focusedStep]);

    return (
        <div className="sections">
            <div className="section">
                <div className="section-header">
                    <span>Parcours de vie</span>
                </div>
                <div className="section-body">
                    <p className="small muted">Chaque étape inclut des besoins pré-remplis. Ajoutez des besoins supplémentaires si besoin.</p>
                    <label className="field-label">Étape à éditer</label>
                    <select value={focusedStep} onChange={(e) => setFocusedStep(e.target.value as ParcoursStepKey)}>
                        {PARCOURS_STEPS.map(step => (
                            <option key={step} value={step}>{PARCOURS_CONFIG[step].label}</option>
                        ))}
                    </select>
                    <div className="parcours-step" key={focusedStep}>
                        <div className="parcours-header">
                            <div className="pill-tooltip">
                                <span className="pill muted">{plannedNeeds.count} besoins prévus</span>
                                <div className="pill-tooltip-panel">
                                    <p className="pill-tooltip-title">Besoins pré-remplis</p>
                                    {plannedNeeds.items.length > 0 ? (
                                        <ul>
                                            {plannedNeeds.items.map(item => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="muted small">Aucun besoin pré-rempli</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="parcours-extras">
                            {(['etude', 'sante', 'sport'] as DatasetKey[]).map(domain => {
                                const options = categoriesByDomain[domain];
                                const current = selectionDraft[focusedStep][domain];
                                const label = domain === 'etude' ? 'Éducation' : domain === 'sante' ? 'Santé' : 'Sport';
                                return (
                                    <div key={`${focusedStep}-${domain}`} className="extra-row">
                                        <label className="field-label">{label} — ajouter un besoin</label>
                                        <div className="extra-controls">
                                            <select
                                                value={current}
                                                onChange={(e) => onDraftChange(focusedStep, domain, e.target.value)}
                                            >
                                                <option value="">Choisir une catégorie</option>
                                                {options.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                            <button className="add-btn" type="button" onClick={() => onAddExtra(focusedStep, domain)}>
                                                Ajouter
                                            </button>
                                        </div>
                                        {extraNeeds[focusedStep][domain].length > 0 && (
                                            <p className="small muted">Ajouts : {extraNeeds[focusedStep][domain].join(', ')}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="section">
                <div className="section-header">
                    <span>Parcours d&apos;opportunités</span>
                </div>
                <div className="section-body">
                    {!hasBase && <p className="small">Sélectionnez un point sur la carte pour préparer l’analyse.</p>}

                    <div className="profil-actions">
                        <button className="primary-btn" type="button" onClick={onRunAnalysis} disabled={!canRun || loading}>
                            {loading ? 'Analyse en cours...' : results.length > 0 ? 'Recalculer le parcours' : 'Lancer le parcours'}
                        </button>
                        {needsDirty && hasBase && !loading && (
                            <p className="small muted">Des changements sont en attente d&apos;analyse.</p>
                        )}
                        <p className="small muted">Rappel : temps estimés à {speedKmh} km/h en voiture.</p>
                    </div>
                    {error && <p className="small error-text">{error}</p>}

                    {hasBase && (results.length > 0 || loading) && (
                        <div className="profil-table">
                            <div className="profil-row profil-head">
                                <span>Étape • besoin</span>
                                <span>Service trouvé</span>
                                <span>Estimation</span>
                                <span>Accessibilité</span>
                            </div>
                            {results.map(result => {
                                const serviceLabel = result.item
                                    ? result.item.nom
                                    : 'Aucun service';
                                const stepLabel = PARCOURS_CONFIG[result.step].label;
                                const domainLabel = result.domain === 'etude' ? 'Éducation' : result.domain === 'sante' ? 'Santé' : 'Sport';
                                return (
                                    <div className="profil-row" key={`${result.step}-${result.domain}-${result.category}`}>
                                        <span className="profil-need">
                                            <span className="profil-need-title">{stepLabel} — {domainLabel}</span>
                                            <span className="small muted">{result.category}</span>
                                        </span>
                                        <span className="profil-service">
                                            <span className="profil-service-title">{serviceLabel}</span>
                                        </span>
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
                            {loading && results.length === 0 && (
                                <div className="profil-row">
                                    <span className="muted">Calcul en cours...</span>
                                    <span className="muted">—</span>
                                    <span className="muted">—</span>
                                    <span className="muted">—</span>
                                </div>
                            )}
                        </div>
                    )}

                    {hasBase && !loading && results.length === 0 && (
                        <p className="small">Aucun service trouvé pour ces besoins.</p>
                    )}

                    <div className="profil-summary">
                        <div className="profil-counts">
                            <span>🟢 {counts.good}</span>
                            <span>🟠 {counts.medium}</span>
                            <span>🔴 {counts.bad}</span>
                        </div>
                        {averageMinutes != null && (
                            <p className="small">Temps moyen de trajet : {averageMinutes} min</p>
                        )}
                        {globalScore != null && (
                            <p className="small">Score d&apos;opportunités : {globalScore} / 100</p>
                        )}
                        <p className="small muted">{summaryText}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function getAccessibilityLevel(minutes: number): AccessLevel {
    return accessibilityLevel(minutes);
}
