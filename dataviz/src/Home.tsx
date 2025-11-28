import { useState, useEffect, Suspense, useRef, forwardRef, lazy } from 'react';
import type { ReactNode } from 'react';

const LazyScene = lazy(() => import('./IsulaScene'));
const BASE_URL = import.meta.env.BASE_URL;

type HomeProps = {
  onEnterApp: () => void;
  prefetching?: boolean;
  ready?: boolean;
};

type InfoCardProps = {
  title: string;
  body: ReactNode;
  note?: ReactNode;
  visible: boolean;
  cardId?: string;
  overlay?: ReactNode;
};

const InfoCard = forwardRef<HTMLDivElement, InfoCardProps>(({ title, body, note, visible, cardId, overlay }, ref) => (
  <div ref={ref} data-card-id={cardId} className="h-screen relative flex items-center justify-center px-12">
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
    {overlay ? (
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
        {overlay}
      </div>
    ) : null}
  </div>
));

InfoCard.displayName = 'InfoCard';

export function Home({ onEnterApp, prefetching = false, ready = false }: HomeProps) {
  const [scrollY, setScrollY] = useState(0);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [playAnimation, setPlayAnimation] = useState(false);
  const [playTrigger, setPlayTrigger] = useState(0);
  const [hasPlayedAnimation, setHasPlayedAnimation] = useState(false);
  const [showScene, setShowScene] = useState(false);
  const [activeCard, setActiveCard] = useState<'intro' | 'card1' | 'card2' | 'card3'>('intro');
  type CardId = 'card1' | 'card2' | 'card3';
  const textRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);

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
        let topEntry: { id: CardId; ratio: number } | null = null;
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.cardId as CardId | undefined;
          if (!id) return;
          if (entry.isIntersecting) {
            if (!topEntry || entry.intersectionRatio > topEntry.ratio) {
              topEntry = { id, ratio: entry.intersectionRatio };
            }
          }
        });
        if (topEntry !== null) {
          const { id } = topEntry;
          setActiveCard(id);
          return;
        }
        if (window.scrollY < 200) {
          setActiveCard('intro');
        }
      },
      { threshold: [0.2, 0.4, 0.6, 0.8, 1] }
    );

    [card1Ref, card2Ref, card3Ref].forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });

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

  useEffect(() => {
    console.log('📍 Carte active changée pour :', activeCard);
    if (activeCard === 'card1' && !hasPlayedAnimation) {
      setPlayAnimation(true);
      setPlayTrigger((t) => t + 1);
      //I know it's pointless, leave me be
      setHasPlayedAnimation(false);
    } else if (activeCard !== 'card1') {
      setPlayAnimation(false);
    }
  }, [activeCard, hasPlayedAnimation]);

  const FADE_TEXT_START = 0;
  const FADE_TEXT_END = 300;
  const MOVE_MODEL_START = 600;
  const MOVE_MODEL_END = 900;

  const textOpacity = Math.max(0, 1 - (scrollY - FADE_TEXT_START) / (FADE_TEXT_END - FADE_TEXT_START));
  const moveProgress = Math.min(1, Math.max(0, (scrollY - MOVE_MODEL_START) / (MOVE_MODEL_END - MOVE_MODEL_START)));
  const leftStage = activeCard === 'card3' ? 'cartogram' : activeCard === 'card2' ? 'image' : 'model';

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

      <div className="relative z-10 pointer-events-none">

        <div className="h-screen flex flex-col items-center justify-center pointer-events-none relative">

          {showScene ? (
            <div className="absolute inset-0 opacity-85 pointer-events-none">
              <Suspense fallback={null}>
                <LazyScene playAnimation={false} />
              </Suspense>
            </div>
          ) : null}

          <div
            ref={textRef}
            style={{ opacity: textOpacity }}
            className="flex flex-col items-center z-10 mt-64 pointer-events-auto will-change-transform"
          >
            <h1 className="text-7xl font-black text-black tracking-tighter border-4 border-black p-6 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] text-center">
              DATAVIZ CHALLENGE 2025 - Vivre le territoire
            </h1>
            <p className="mt-8 font-mono text-white font-bold animate-bounce text-2xl px-4 py-2 bg-black/80 border-2 border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.35)]">
              <span className="drop-shadow-[0_1px_0_#000,1px_0_0_#000,-1px_0_0_#000,0_-1px_0_#000]">↓ Dérouler</span>
            </p>
          </div>
        </div>

        <div className="h-[20vh] flex items-center justify-center">

        </div>

        <div className="min-h-screen flex items-start pointer-events-none border-4 border-black relative bg-white">

          <div className="w-1/2 h-screen sticky top-0 flex items-center justify-center border-r-4 border-blue-200 border-dashed bg-blue-50/30 pointer-events-auto">
            <div className="relative w-full h-full flex items-center justify-center">
              <div
                className="absolute inset-0 transition-opacity duration-700"
                style={{ opacity: leftStage === 'model' ? 1 : 0, pointerEvents: leftStage === 'model' ? 'auto' : 'none' }}
              >
                {showScene ? (
                  <Suspense fallback={null}>
                    <LazyScene playAnimation={playAnimation} playOnce={false} loopWithDelayMs={0} playTrigger={playTrigger} />
                  </Suspense>
                ) : null}
              </div>

              <div
                className="absolute inset-0 transition-opacity duration-700"
                style={{ opacity: leftStage === 'image' ? 1 : 0, pointerEvents: leftStage === 'image' ? 'auto' : 'none' }}
              >
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6">
                  <div className="w-full h-full bg-[#efefef] border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden">
                    <img
                      src={`${BASE_URL}deformation_pop.png`}
                      alt="Déformation population"
                      className="object-contain w-full h-full mix-blend-multiply contrast-125"
                    />
                  </div>
                  <p className="space-y-4 font-mono text-lg text-gray-600 bg-white border border-dashed border-black px-3 py-2">
                    Déformation des communes en fonction de l'évolution de leur population entre 1936 et 2022. Des espaces blancs signifient que la commune s'est dépeuplée.
                  </p>
                </div>
              </div>

              <div
                className="absolute inset-0 transition-opacity duration-700"
                style={{ opacity: leftStage === 'cartogram' ? 1 : 0, pointerEvents: leftStage === 'cartogram' ? 'auto' : 'none' }}
              >
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6">
                  <div className="w-full h-full bg-[#efefef] border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden">
                    <img
                      src={`${BASE_URL}anamorphe_gene.png`}
                      alt="Cartogramme des distances aux médecins généralistes"
                      className="object-contain w-full h-full mix-blend-multiply contrast-125"
                    />
                  </div>
                  <p className="space-y-1 font-mono text-sm text-gray-600 bg-white border border-dashed border-black px-3 py-2 w-full text-center">
                    Cartogramme pré-calculé : déformation des communes de Corse selon la distance entre leur centroïde et le médecin généraliste le plus proche.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-1/2 flex flex-col border-l-4 border-dashed pointer-events-auto">

            <InfoCard
              ref={card1Ref}
              cardId="card1"
              title="Géographie"
              visible={moveProgress >= 0.8}
              body={
                <div className="space-y-4 font-mono text-lg">
                  <p className="text-gray-600">
                    La Corse représente une surface de près de 8700km². C&apos;est la quatrième plus grande île de
                    méditerranée, et la plus montagneuse de toutes. Elle comporte un grand nombre de vallées, et des
                    sommets allant jusqu&apos;à 2700 mètres d&apos;altitudes.
                  </p>
                  <p className="text-gray-600">
                    En fait, si on l&apos;aplatissait complètement, elle gagnerait près de 1000km²*.
                  </p>
                </div>
              }
              note="* Calcul réalisé avec QGIS à partir du DEM fourni par l'IGN."
            />

            <InfoCard
              ref={card2Ref}
              cardId="card2"
              title="Démographie"
              visible={moveProgress >= 0.8}
              body={
                <div className="space-y-4 font-mono text-lg">
                  <p className="text-gray-600">
                    Avec environ 350 000 habitants en 2022¹, il y a eu une véritable explosion démographique depuis les deux guerres mondiales, qui avaient laissé la Corse exsangue: sa population passant de 290.000 habitants² en 1911 à 187.000 en 1936.
                  </p>
                  <p className="text-gray-600">
                    Cette explosion a pris place inégalement dans le territoire, avec des communes presques entièrement vidées de leurs habitants, tandis que le reste de la population et des activités se sont concentrés dans quelques pôles urbains.
                  </p>

                </div>
              }
              note={<>
                ¹ Insee dossier complet région de Corse (94)
                <br />
                ² Lefèvbre «La population de la Corse», 1957.
              </>}
            />

            <InfoCard
              ref={card3Ref}
              cardId="card3"
              title="Territoire déformant"
              visible={moveProgress >= 0.9}
              overlay={
                <p className="font-mono text-lg text-white font-bold animate-bounce inline-block px-4 py-2 bg-black/90 border-2 border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.35)]">
                  <span className="drop-shadow-[0_1px_0_#000,1px_0_0_#000,-1px_0_0_#000,0_-1px_0_#000]">↓ Dérouler</span>
                </p>
              }
              body={
                <div className="space-y-3 text-gray-600">
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

  );
}
