import { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Resize, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

type HomeProps = {
  onEnterApp: () => void;
  prefetching?: boolean;
  ready?: boolean;
};

// Construct the URL correctly based on Vite's public dir behavior
const BASE_URL = import.meta.env.BASE_URL;
const MODEL_URL = `${BASE_URL}Isula.glb`;

// Preload the model to ensure it's available immediately
// useGLTF.preload(MODEL_URL);

// Component to handle mouse hover rotation
function InteractionRig({ children }: { children: React.ReactNode }) {
  return <group>{children}</group>;
}

// Placeholder for the model component
function Model({ url, step = 0 }: { url: string, step?: number }) {
  return (
    <mesh>
      <boxGeometry />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}

export function Home({ onEnterApp, prefetching = false, ready = false }: HomeProps) {
  console.log("Home component rendering", { prefetching, ready });
  const [scrollY, setScrollY] = useState(0);
  const [activeStep, setActiveStep] = useState(0); // 0: None, 1: Card 1, 2: Card 2
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const textRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      setParallax({ x: x * 20, y: y * -20 });
    };

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    if (entry.target === card1Ref.current) {
                        console.log("Observer: Card 1 visible");
                        setActiveStep(1);
                    } else if (entry.target === card2Ref.current) {
                        console.log("Observer: Card 2 visible");
                        setActiveStep(2);
                    } else if (entry.target === card3Ref.current) {
                        console.log("Observer: Card 3 visible");
                        setActiveStep(3);
                    }
                }
            });
        },
        { threshold: 0.5 } // Trigger when 50% of the card is visible
    );

    if (card1Ref.current) observer.observe(card1Ref.current);
    if (card2Ref.current) observer.observe(card2Ref.current);
    if (card3Ref.current) observer.observe(card3Ref.current);

    // Debug: Check if the file is reachable
    fetch(MODEL_URL)
        .then(res => console.log(`Fetch check for ${MODEL_URL}:`, res.status, res.statusText))
        .catch(err => console.error(`Fetch check failed for ${MODEL_URL}:`, err));

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      observer.disconnect();
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
        className="fixed inset-0 pointer-events-auto"
        style={{ zIndex: 5 }}
      >
        <Canvas shadows camera={{ position: [0, 0, 5], fov: 50 }}>
          <ambientLight intensity={0.05} />
          <directionalLight 
            position={[5, 2, 5]} 
            castShadow 
            intensity={10} 
            shadow-mapSize={[4096, 4096]} 
            shadow-bias={-0.0005}
          />
          
          <Suspense fallback={<mesh><boxGeometry /><meshStandardMaterial color="red" /></mesh>}>
             <group position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <InteractionRig>
                    <Model url={MODEL_URL} />
                </InteractionRig>
             </group>
            <Environment preset="forest" />
          </Suspense>
        </Canvas>
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
             
             {/* Second Model Instance - Fades out on step 2 or 3 */}
             <div 
                className="absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out"
                style={{ opacity: activeStep >= 2 ? 0 : 1 }}
             >
                <Canvas shadows camera={{ position: [0, 0, 5], fov: 50 }}>
                  <ambientLight intensity={0.1} />
                  <directionalLight 
                    position={[5, 2, 5]} 
                    castShadow 
                    intensity={4} 
                    shadow-mapSize={[2048, 2048]} 
                    shadow-bias={-0.0005}
                  />
                  
                  <Suspense fallback={null}>
                     <group position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <InteractionRig>
                            <Model url={MODEL_URL} step={activeStep} />
                        </InteractionRig>
                     </group>
                    <Environment preset="forest" />
                  </Suspense>
                </Canvas>
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
            
            {/* Card 1 Container */}
            <div className="h-screen flex items-center justify-center px-12">
                {/* Card 1 */}
                <div 
                  ref={card1Ref}
                  className="max-w-xl bg-white border-4 border-black p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all duration-500 transform"
                  style={{ 
                    opacity: moveProgress >= 0.8 ? 1 : 0,
                    transform: `translateY(${moveProgress >= 0.8 ? 0 : 20}px)`
                  }}
                >
                  <h2 className="text-5xl font-bold mb-6 text-black uppercase decoration-4 underline-offset-4 border-b-4 border-black pb-2">
                    Géographie
                  </h2>
                  <div className="space-y-4 font-mono text-lg">
                    <p className="text-gray-600">
                      La Corse représente une surface de près de 8700km². C'est la quatrième plus grande île de méditerranée, et la plus montagneuse de toutes. Elle comporte un grand nombre de vallées, et des sommets allant jusqu'à 2700 mètres d'altitudes.
                    </p>
                      
                    <p className="text-gray-600">
                      En fait, si on l'aplatissait complètement, elle gagnerait près de 1000km²*.
                    </p>
                    
                    {/* Separator and Footnotes */}
                    <div className="pt-4 mt-4 border-t-2 border-gray-200">
                        <p className="text-sm text-gray-400 italic">
                            * Calcul réalisé avec QGIS à partir du DEM fourni par l'IGN.
                        </p>
                    </div>
                  </div>
                </div>
            </div>

            {/* Card 2 Container */}
            <div className="h-screen flex items-center justify-center px-12">
                {/* Card 2 */}
                <div 
                  ref={card2Ref}
                  className="max-w-xl bg-white border-4 border-black p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all duration-500 transform"
                  style={{ 
                    opacity: moveProgress >= 0.8 ? 1 : 0,
                    transform: `translateY(${moveProgress >= 0.8 ? 0 : 20}px)`
                  }}
                >
                  <h2 className="text-5xl font-bold mb-6 text-black uppercase decoration-4 underline-offset-4 border-b-4 border-black pb-2">
                    Démographie
                  </h2>
                  <div className="space-y-4 font-mono text-lg">
                    <p className="text-gray-600">
                      Avec environ 350 000 habitants en 2022¹, il y a eu une véritable explosion démographique depuis les deux guerres mondiales, qui avaient laissé la Corse exsangue: sa population passant de 290.000 habitants² en 1911 à 187.000 en 1936.
                    </p>
                    <p className="text-gray-600">
                      Cette explosion a pris place inégalement dans le territoire, avec des communes presques entièrement vidées de leurs habitants, tandis que le reste de la population et des activités se sont concentrés dans quelques pôles urbains, principalement Ajaccio et Bastia.
                    </p>
                    
                    {/* Separator and Footnotes */}
                    <div className="pt-4 mt-4 border-t-2 border-gray-200">
                        <p className="text-sm text-gray-400 italic">
                            1 Insee dossier complet région de Corse (94)
                            2 Lefèvbre "La population de la Corse", 1957.
                        </p>
                    </div>
                  </div>
                </div>
            </div>

            {/* Card 3 Container */}
            <div className="h-screen flex flex-col items-center justify-center px-12 relative">
                {/* Card 3 - CARTOGRAM DESCRIPTION AREA */}
                <div 
                  ref={card3Ref}
                  className="max-w-xl bg-white border-4 border-red-500 p-10 shadow-[12px_12px_0px_0px_rgba(239,68,68,1)] transition-all duration-500 transform relative"
                  style={{ 
                    opacity: moveProgress >= 0.8 ? 1 : 0,
                    transform: `translateY(${moveProgress >= 0.8 ? 0 : 20}px)`
                  }}
                >
                  <div className="absolute -top-4 left-4 bg-red-500 text-white px-2 py-1 font-bold text-xs">
                        CARTOGRAM DESCRIPTION AREA
                  </div>
                  <h2 className="text-5xl font-bold mb-6 text-black uppercase decoration-4 underline-offset-4 border-b-4 border-black pb-2">
                    Territoire déformant
                  </h2>
                  <div className="space-y-4 font-mono text-lg">
                    <p className="text-gray-600">
                      Cette concentration de la population se renforce elle-même, avec les activités, les services publics, les emplois tendant à se rejoindre dans les plus grands pôles urbains.
                    </p>
                    <p className="text-gray-600">
                      L'intérieur des terres, autrefois vivant et agricole, continue à se vider, poursuivant le processus d'exode rural entamé à l'échelle mondiale.
                    </p>
                    <p className="text-gray-600">
                      D'ici 2050, il est estimé que deux tiers de la population mondiale vivront dans des villes¹. En attendant, cette transition transforme complètement l'expérience et la vision que deux corses peuvent avoir de l'île. 
                    </p>
                    
                    {/* Separator and Footnotes */}
                    <div className="pt-4 mt-4 border-t-2 border-gray-200">
                        <p className="text-sm text-gray-400 italic">
                            1 United Nations - World Urbanization Prospects 2025
                        </p>
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-12 left-0 -translate-x-1/2 z-20">
                    <p className="font-mono text-gray-500 animate-bounce bg-white px-3 py-1 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                        ↓ Continuer
                    </p>
                </div>
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
    </div>
  );
}
