import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Home } from './Home';
import { ObjectsIn, loadGeoJSON } from './core/engine';
import type { DatasetKey } from './core/datasets';

// React DevTools can choke on renderers that report an empty version (seen with some 3D libs).
// Patch the hook in dev to force a fallback semver and avoid the "Invalid argument not valid semver" crash.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const fixRenderer = (id: unknown, renderer: any) => {
    if (renderer && (!renderer.version || typeof renderer.version !== 'string' || !renderer.version.trim())) {
      renderer.version = '0.0.0';
    }
  };
  if (hook?.renderers instanceof Map) {
    hook.renderers.forEach((renderer: any, id: unknown) => fixRenderer(id, renderer));
    const origSet = hook.renderers.set.bind(hook.renderers);
    hook.renderers.set = (id: any, renderer: any) => {
      fixRenderer(id, renderer);
      return origSet(id, renderer);
    };
  }
}

const App = lazy(() => import('./App'));
const datasetsToPreload: DatasetKey[] = ['etude', 'sante', 'sport'];

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="w-screen h-screen flex items-center justify-center text-lg font-semibold text-gray-700">
      {label}
    </div>
  );
}

function Root() {
  const [stage, setStage] = useState<'home' | 'app'>('home');
  const [prefetching, setPrefetching] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const prewarm = async () => {
      const safe = <T,>(label: string, promise: Promise<T>) =>
        promise.catch((err) => {
          console.warn(`[prefetch] ${label} failed`, err);
          return undefined as unknown as T;
        });

      setPrefetching(true);

      const tasks = [
        safe('communes.geojson', loadGeoJSON('communes.geojson')),
        safe('corse.geojson', loadGeoJSON('corse.geojson')),
        ...datasetsToPreload.map((ds) => safe(`${ds}.geojson`, ObjectsIn(ds, 'all'))),
        safe('App chunk', import('./App')),
      ];

      await Promise.allSettled(tasks);
      if (cancelled) return;
      setReady(true);
      setPrefetching(false);
    };

    prewarm().catch((err) => {
      console.warn('[prefetch] unexpected error', err);
      if (!cancelled) setPrefetching(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (stage === 'home') {
    return <Home onEnterApp={() => setStage('app')} prefetching={prefetching} ready={ready} />;
  }

  return (
    <Suspense fallback={<LoadingScreen label="Chargement de l'application..." />}>
      <App />
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
