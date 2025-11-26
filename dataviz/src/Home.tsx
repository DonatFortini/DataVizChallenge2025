import { useState, useEffect, Suspense, useRef, forwardRef, lazy } from 'react';

const LazyScene = lazy(() => import('./IsulaScene'));

type HomeProps = {
  onEnterApp: () => void;
  prefetching?: boolean;
  ready?: boolean;
};

type InfoCardProps = {
  title: string;
  body: React.ReactNode;
  note?: React.ReactNode;
  visible: boolean;
};

const InfoCard = forwardRef<HTMLDivElement, InfoCardProps>(({ title, body, note, visible }, ref) => (
  <div ref={ref} className="h-screen flex items-center justify-center px-12">
    <div
      className="max-w-xl bg-white border-4 border-black p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all duration-500 transform"
      style={{
        opacity: visible ? 1 : 0,
        transform: `translateY(${visible ? 0 : 20}px)`
      }}
    >
      <h2 className="text-5xl font-bold mb-6 text-black uppercase decoration-4 underline-offset-4 border-b-4 border-black pb-2">
        {title}
      </h2>
      <div className="space-y-4 font-mono text-lg">
        {body}
        {note ? (
          <div className="pt-4 mt-4 border-t-2 border-gray-200">
            <p className="text-sm text-gray-400 italic">{note}</p>
          </div>
        ) : null}
      </div>
    </div>
  </div>
));

InfoCard.displayName = 'InfoCard';

export function Home({ onEnterApp, prefetching = false, ready = false }: HomeProps) {
  const [scrollY, setScrollY] = useState(0);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [showScene, setShowScene] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let activated = false;
    const activateScene = () => {
      if (!activated) {
        activated = true;
        setShowScene(true);
      }
    };

    const handleScroll = () => {
      setScrollY(window.scrollY);
      activateScene();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      setParallax({ x: x * 20, y: y * -20 });
      activateScene();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === sceneRef.current) {
              activateScene();
            }
          }
        });
      },
      { threshold: 0.2 }
    );

    if (sceneRef.current) observer.observe(sceneRef.current);

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);

    const timer = window.setTimeout(activateScene, 800);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const FADE_TEXT_START = 0;
  const FADE_TEXT_END = 300;
  const MOVE_MODEL_START = 600;
  const MOVE_MODEL_END = 900;

  const textOpacity = Math.max(0, 1 - (scrollY - FADE_TEXT_START) / (FADE_TEXT_END - FADE_TEXT_START));
  const moveProgress = Math.min(1, Math.max(0, (scrollY - MOVE_MODEL_START) / (MOVE_MODEL_END - MOVE_MODEL_START)));

  return (
    <div className="relative bg-white min-h-[300vh]">

      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[50vh] left-1/2 w-[70vh] h-[70vh] border-12 border-dashed border-orange-300 rounded-full"
          style={{
            opacity: textOpacity,
            transform: `translate(-50%, -50%) translate(${parallax.x}px, ${parallax.y}px)`,
            animation: 'spin 60s linear infinite'
          }}
        />
        <style>{`
            @keyframes spin {
                from { transform: translate(-50%, -50%) translate(${parallax.x}px, ${parallax.y}px) rotate(0deg); }
                to { transform: translate(-50%, -50%) translate(${parallax.x}px, ${parallax.y}px) rotate(360deg); }
            }
         `}</style>
      </div>

      <div
        ref={sceneRef}
        className="fixed inset-0 pointer-events-auto"
        style={{ zIndex: 5 }}
      >
        {showScene && (
          <Suspense fallback={null}>
            <LazyScene />
          </Suspense>
        )}
      </div>

      <div className="relative z-10 pointer-events-none">

        <div className="h-screen flex flex-col items-center justify-center pointer-events-none relative">

          <div
            ref={textRef}
            style={{ opacity: textOpacity }}
            className="flex flex-col items-center z-10 mt-64 pointer-events-auto will-change-transform"
          >
            <h1 className="text-7xl font-black text-black tracking-tighter border-4 border-black p-6 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] text-center">
              DATAVIZ CHALLENGE 2025 - Vivre le territoire
            </h1>
            <p className="mt-8 font-mono text-white-500 animate-bounce">↓ Dérouler</p>
          </div>
        </div>

        <div className="h-[20vh] flex items-center justify-center">

        </div>

        <div className="min-h-screen flex items-start pointer-events-none border-4 border-black relative bg-white">

          <div className="w-1/2 h-screen sticky top-0 flex items-center justify-center border-r-4 border-blue-200 border-dashed bg-blue-50/30 pointer-events-auto">

            <div className="w-full h-full">
              {showScene && (
                <Suspense fallback={null}>
                  <LazyScene />
                </Suspense>
              )}
            </div>
          </div>

          <div className="w-1/2 flex flex-col border-l-4 border-dashed pointer-events-auto">

            <InfoCard
              ref={card1Ref}
              title="Géographie"
              visible={moveProgress >= 0.8}
              body={
                <p className="text-gray-600">
                  La Corse représente une surface de près de 8700km². Elle est la plus montagneuse des trois grande îles de méditerranée occidentale.
                </p>
              }
              note="* Notes de bas de page"
            />

            <InfoCard
              ref={card2Ref}
              title="Démographie"
              visible={moveProgress >= 0.8}
              body={
                <p className="text-gray-600">
                  Avec environ 350 000 habitants, la Corse a une densité de population relativement faible par rapport au continent.
                </p>
              }
              note="* Source: INSEE 2024"
            />
          </div>


        </div>

        <div className="h-screen border-4 border-gray-300 flex items-center justify-center bg-gray-100 pointer-events-auto">
          <div className="max-w-2xl text-center space-y-6 px-6">
            <p className="text-xl font-semibold text-gray-700">
              Prêt à explorer la carte interactive et les données du territoire ?
            </p>
            <div className="inline-flex items-center gap-3">
              <button
                type="button"
                onClick={onEnterApp}
                disabled={!ready}
                className="px-6 py-3 bg-black text-white font-bold uppercase tracking-wide border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,0.2)]"
              >
                Entrer dans l'application
              </button>
              <div className="text-left text-sm text-gray-600">
                <p className="font-semibold">Préparation des données</p>
                <p className="text-gray-500">
                  {prefetching ? 'Chargement des GeoJSON...' : ready ? 'Données prêtes et mises en cache.' : 'En attente de mise en cache...'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
