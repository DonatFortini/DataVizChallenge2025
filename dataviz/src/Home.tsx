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

const BASE_URL = import.meta.env.BASE_URL;

export function Home({ onEnterApp, prefetching = false, ready = false }: HomeProps) {
  const [scrollY, setScrollY] = useState(0);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [showScene, setShowScene] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    console.log("Home useEffect mounted. Refs state:", {
      scene: sceneRef.current,
      card1: card1Ref.current,
      card2: card2Ref.current,
      card3: card3Ref.current
    });

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
          const targetName = 
            entry.target === card1Ref.current ? 'Card 1' :
            entry.target === card2Ref.current ? 'Card 2' :
            entry.target === card3Ref.current ? 'Card 3' :
            entry.target === sceneRef.current ? 'Scene' : 'Unknown';
            
          console.log(`Observer update for ${targetName}:`, {
            isIntersecting: entry.isIntersecting,
            ratio: entry.intersectionRatio,
            boundingClientRect: entry.boundingClientRect
          });

          if (entry.isIntersecting) {
            if (entry.target === sceneRef.current) {
              console.log("Scene container visible -> activating scene");
              activateScene();
            }
            if (entry.target === card1Ref.current) {
              console.log("Step 1 active (Géographie)");
              setActiveStep(1);
            }
            if (entry.target === card2Ref.current) {
              console.log("Step 2 active (Démographie)");
              setActiveStep(2);
            }
            if (entry.target === card3Ref.current) {
              console.log("Step 3 active (Territoire)");
              setActiveStep(3);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    if (sceneRef.current) observer.observe(sceneRef.current);
    if (card1Ref.current) observer.observe(card1Ref.current);
    if (card2Ref.current) observer.observe(card2Ref.current);
    if (card3Ref.current) observer.observe(card3Ref.current);

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
            <LazyScene step={0} />
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
          {/* Left Side: Model Area */}
          <div className="w-1/2 h-screen sticky top-0 flex items-center justify-center relative border-r-4 border-blue-200 border-dashed bg-blue-50/30 pointer-events-auto overflow-hidden">
             
            <div 
                className="w-full h-full absolute inset-0 z-10 transition-opacity duration-1000 ease-in-out"
                style={{ opacity: activeStep === 1 ? 1 : 0 }}
            >
              {showScene && (
                <Suspense fallback={null}>
                  <LazyScene step={activeStep} />
                </Suspense>
              )}
            </div>

             {/* Image 1 - Fades in on step 2 */}
             <div 
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ease-in-out pointer-events-none"
                style={{ opacity: activeStep === 2 ? 1 : 0 }}
             >
                <div className="w-[90%] h-[90%] flex flex-col bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4">
                    <div className="flex-1 relative min-h-0 w-full overflow-hidden">
                        <img 
                            src={`${BASE_URL}commune_change.png`}
                            alt="Changement de démogrpahie des communes" 
                            className="absolute inset-0 w-full h-full object-cover scale-135" 
                        />
                    </div>
                    <div className="mt-2 pt-2 border-t-2 border-gray-100 text-center shrink-0">
                        <span className="text-sm font-mono text-gray-500">Evolution de la population des communes entre 1936 et 2022. Les communes sont déformées selon leur pourcentage de changement. Dans le cas le plus extrême, Borgu, la population a augmenté de 4000%.</span>
                    </div>
                </div>
             </div>

             {/* Image 2 - Fades in on step 3 - CARTOGRAM VISUALIZATION AREA */}
             <div 
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ease-in-out pointer-events-none"
                style={{ opacity: activeStep === 3 ? 1 : 0 }}
             >
                <div className="w-[90%] h-[90%] flex flex-col bg-white border-4 border-red-500 shadow-[8px_8px_0px_0px_rgba(239,68,68,1)] p-4 relative">
                    <div className="absolute -top-4 left-4 bg-red-500 text-white px-2 py-1 font-bold text-xs z-50">
                        CARTOGRAM VISUALIZATION AREA
                    </div>
                    <div className="flex-1 relative min-h-0 w-full overflow-hidden">
                        <img 
                            src="https://placehold.co/800x800/blue/white?text=Inegalites" 
                            alt="Inégalités de territoire" 
                            className="absolute inset-0 w-full h-full object-cover" 
                        />
                    </div>
                    <div className="mt-2 pt-2 border-t-2 border-gray-100 text-center shrink-0">
                        <span className="text-sm font-mono text-gray-500">Légende pour les inégalités de territoire...</span>
                    </div>
                </div>
             </div>
          </div>

          <div className="w-1/2 flex flex-col border-l-4 border-dashed pointer-events-auto">
            
            <InfoCard
              ref={card1Ref}
              title="Géographie"
              visible={moveProgress >= 0.8}
              body={
                <div className="space-y-4">
                  <p className="text-gray-600">
                    La Corse représente une surface de près de 8700km². C'est la quatrième plus grande île de méditerranée, et la plus montagneuse de toutes. Elle comporte un grand nombre de vallées, et des sommets allant jusqu'à 2700 mètres d'altitudes.
                  </p>
                  <p className="text-gray-600">
                    En fait, si on l'aplatissait complètement, elle gagnerait près de 1000km²*.
                  </p>
                </div>
              }
              note="* Calcul réalisé avec QGIS à partir du DEM fourni par l'IGN."
            />

            <InfoCard
              ref={card2Ref}
              title="Démographie"
              visible={moveProgress >= 0.8}
              body={
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Avec environ 350 000 habitants en 2022¹, il y a eu une véritable explosion démographique depuis les deux guerres mondiales, qui avaient laissé la Corse exsangue: sa population passant de 290.000 habitants² en 1911 à 187.000 en 1936.
                  </p>
                  <p className="text-gray-600">
                    Cette explosion a pris place inégalement dans le territoire, avec des communes presques entièrement vidées de leurs habitants, tandis que le reste de la population et des activités se sont concentrés dans quelques pôles urbains, principalement Ajaccio et Bastia.
                  </p>
                </div>
              }
              note="1 Insee dossier complet région de Corse (94) | 2 Lefèvbre 'La population de la Corse', 1957."
            />

            <InfoCard
              ref={card3Ref}
              title="Territoire déformant"
              visible={moveProgress >= 0.8}
              body={
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Cette concentration de la population se renforce elle-même, avec les activités, les services publics, les emplois tendant à se rejoindre dans les plus grands pôles urbains.
                  </p>
                  <p className="text-gray-600">
                    L'intérieur des terres, autrefois vivant et agricole, continue à se vider, poursuivant le processus d'exode rural entamé à l'échelle mondiale.
                  </p>
                  <p className="text-gray-600">
                    D'ici 2050, il est estimé que deux tiers de la population mondiale vivront dans des villes¹. En attendant, cette transition transforme complètement l'expérience et la vision que deux corses peuvent avoir de l'île. 
                  </p>
                </div>
              }
              note="1 United Nations - World Urbanization Prospects 2025"
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
