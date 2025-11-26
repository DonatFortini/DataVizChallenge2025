import { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Resize } from '@react-three/drei';
import * as THREE from 'three';

// Construct the URL correctly based on Vite's public dir behavior
const BASE_URL = import.meta.env.BASE_URL;
const MODEL_URL = `${BASE_URL}Isula.glb`;

// Preload the model to ensure it's available immediately
useGLTF.preload(MODEL_URL);

// Component to handle mouse hover rotation
function InteractionRig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null!);

  useFrame((state) => {
    // Target rotation based on mouse position (state.pointer is normalized -1 to 1)
    // Side-to-side movement (x) causes tilt (z rotation)
    const targetZ = -state.pointer.x * 0.2; 
    // Up-down movement (y) causes pitch (x rotation)
    const targetX = -state.pointer.y * 0.2;

    // Smoothly interpolate current rotation to target
    if (group.current) {
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, targetZ, 0.1);
        // Ensure Y rotation stays at 0 (no spin)
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
    }
  });

  return <group ref={group}>{children}</group>;
}

// Placeholder for the model component
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  // Clone the scene so we can use it in multiple places simultaneously
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const ref = useRef<THREE.Group>(null!);

  return (
    <group ref={ref}>
        {/* Resize the model to fit in a 2x2x2 box */}
        <Resize scale={4}>
            <primitive object={clonedScene} />
        </Resize>
    </group>
  );
}

export function Home() {
  const [scrollY, setScrollY] = useState(0);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const textRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    const handleMouseMove = (e: MouseEvent) => {
        // Calculate normalized mouse position -1 to 1
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        // Move text slightly opposite to mouse (parallax)
        // 20px max movement
        setParallax({ x: x * 20, y: y * -20 });
    };

    // Intersection Observer for the cards
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    if (entry.target === card1Ref.current) {
                        console.log("EVENT: First card is visible!");
                    } else if (entry.target === card2Ref.current) {
                        console.log("EVENT: Second card is visible!");
                    }
                }
            });
        },
        { threshold: 0.5 } // Trigger when 50% of the card is visible
    );

    if (card1Ref.current) observer.observe(card1Ref.current);
    if (card2Ref.current) observer.observe(card2Ref.current);

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
  }, [MODEL_URL]);

  // Thresholds for animations
  const FADE_TEXT_START = 0;
  const FADE_TEXT_END = 300;
  const MOVE_MODEL_START = 600;
  const MOVE_MODEL_END = 900;

  // Calculate opacity for the initial text
  const textOpacity = Math.max(0, 1 - (scrollY - FADE_TEXT_START) / (FADE_TEXT_END - FADE_TEXT_START));
  
  // Calculate position for the model
  // 0 means centered, 1 means moved to left
  const moveProgress = Math.min(1, Math.max(0, (scrollY - MOVE_MODEL_START) / (MOVE_MODEL_END - MOVE_MODEL_START)));
  
  return (
    <div className="relative bg-white min-h-[300vh]">
      
      {/* CSS Ring Layer - Absolute Positioned to scroll with content, but behind Canvas */}
      {/* z-0 is behind z-1 Canvas */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
         {/* Positioned at 50vh to match the centered text in the first section */}
         <div 
            className="absolute top-[50vh] left-1/2 w-[70vh] h-[70vh] border-[12px] border-dashed border-orange-300 rounded-full"
            style={{
                opacity: textOpacity,
                // Center the ring (-50%) and apply parallax
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

      {/* Fixed Background Layer - First Model */}
      <div 
        className="fixed inset-0 pointer-events-auto"
        style={{ zIndex: 5 }}
      >
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
          <pointLight position={[-10, -10, -10]} />
          
          <Suspense fallback={<mesh><boxGeometry /><meshStandardMaterial color="red" /></mesh>}>
             {/* Replace with your actual GLB file path in the public folder */}
             <group position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <InteractionRig>
                    <Model url={MODEL_URL} />
                </InteractionRig>
             </group>
            <Environment preset="forest" />
          </Suspense>
        </Canvas>
      </div>

      {/* Scrollable Content Layer */}
      <div className="relative z-10 pointer-events-none">
        
        {/* Section 1: Initial View (Top of Sketch) */}
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

        {/* Spacer for transition */}
        <div className="h-[20vh] flex items-center justify-center">

        </div>

        {/* Section 2: Split View (Bottom of Sketch) */}
        <div className="min-h-screen flex items-start pointer-events-none border-4 border-black relative bg-white">
          
          {/* Left Side: Model Area */}
          <div className="w-1/2 h-screen sticky top-0 flex items-center justify-center relative border-r-4 border-blue-200 border-dashed bg-blue-50/30 pointer-events-auto">
             
             {/* Second Model Instance */}
             <div className="w-full h-full">
                <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                  <ambientLight intensity={0.5} />
                  <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
                  <pointLight position={[-10, -10, -10]} />
                  
                  <Suspense fallback={null}>
                     <group position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <InteractionRig>
                            <Model url={MODEL_URL} />
                        </InteractionRig>
                     </group>
                    <Environment preset="forest" />
                  </Suspense>
                </Canvas>
             </div>
          </div>

          {/* Right Side: Text Content */}
          <div className="w-1/2 flex flex-col border-l-4 border-dashed pointer-events-auto">
            
            {/* Card 1 Container */}
            <div ref={card1Ref} className="h-screen flex items-center justify-center px-12">
                {/* Card 1 */}
                <div 
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
                      La Corse représente une surface de près de 8700km². Elle est la plus montagneuse des trois grande îles de méditerranée occidentale. 
                    </p>
                    
                    {/* Separator and Footnotes */}
                    <div className="pt-4 mt-4 border-t-2 border-gray-200">
                        <p className="text-sm text-gray-400 italic">
                            * Notes de bas de page
                        </p>
                    </div>
                  </div>
                </div>
            </div>

            {/* Card 2 Container */}
            <div ref={card2Ref} className="h-screen flex items-center justify-center px-12">
                {/* Card 2 */}
                <div 
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
                      Avec environ 350 000 habitants, la Corse a une densité de population relativement faible par rapport au continent.
                    </p>
                    
                    {/* Separator and Footnotes */}
                    <div className="pt-4 mt-4 border-t-2 border-gray-200">
                        <p className="text-sm text-gray-400 italic">
                            * Source: INSEE 2024
                        </p>
                    </div>
                  </div>
                </div>
            </div>
          </div>

          
        </div>

        {/* Extra space at bottom */}
        <div className="h-screen border-4 border-gray-300 flex items-center justify-center bg-gray-100">
            <span className="text-gray-400 font-bold">FOOTER / EXTRA SPACE</span>
        </div>
      </div>
    </div>
  );
}