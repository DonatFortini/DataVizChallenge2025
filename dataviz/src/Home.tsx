import { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, Environment, OrbitControls } from '@react-three/drei';

// Placeholder for the model component
function Model({ url, position, rotation }: { url: string, position: [number, number, number], rotation: [number, number, number] }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} position={position} rotation={rotation} />;
}

export function Home() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
  
  // We want to move it from center (0) to left. 
  // In Three.js units, 0 is center. Moving left is negative X.
  // Adjust this value based on your model's scale and camera position.
  const modelX = -2.5 * moveProgress; 
  
  // Rotation based on scroll
  const rotationY = scrollY * 0.002;

  return (
    <div className="relative bg-white min-h-[300vh]">
      
      {/* Fixed Background Layer - The 3D Canvas */}
      <div className="fixed inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
          <pointLight position={[-10, -10, -10]} />
          <Suspense fallback={null}>
             {/* Replace with your actual GLB file path in the public folder */}
            <Model 
              url={`${import.meta.env.BASE_URL}model.glb`} 
              position={[modelX, 0, 0]} 
              // Instantiate from the top of the Z axis (rotate X by 90deg) and apply scroll rotation
              rotation={[Math.PI / 2, rotationY, 0]} 
            />
            <Environment preset="city" />
            <OrbitControls 
              enableZoom={false} 
              enablePan={false}
              minAzimuthAngle={-Math.PI / 4}
              maxAzimuthAngle={Math.PI / 4}
              minPolarAngle={Math.PI / 3}
              maxPolarAngle={2 * Math.PI / 3}
              target={[modelX, 0, 0]}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Scrollable Content Layer */}
      <div className="relative z-10 pointer-events-none">
        
        {/* Section 1: Initial View (Top of Sketch) */}
        <div className="h-screen flex flex-col items-center justify-center pointer-events-auto border-b-2 border-dashed border-gray-300 border-4 border-red-500 relative">
          <div className="absolute top-4 left-4 bg-red-500 text-white px-2 py-1 text-xs font-bold">SECTION 1: CENTERED</div>
          
          {/* Visual Guide for Model Position */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -z-10 w-64 h-64 border-4 border-red-300 border-dashed rounded-full flex items-center justify-center opacity-50">
            <span className="text-red-400 font-mono text-sm font-bold text-center">3D MODEL<br/>(CENTERED)</span>
          </div>

          <div style={{ opacity: textOpacity }} className="flex flex-col items-center z-10 mt-64">
            <h1 className="text-7xl font-black text-black tracking-tighter border-4 border-black p-6 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)]">
              &lt;WELCOME&gt;
            </h1>
            <p className="mt-8 font-mono text-gray-500 animate-bounce">↓ Scroll to explore</p>
          </div>
        </div>

        {/* Spacer for transition */}
        <div className="h-[20vh] border-l-4 border-r-4 border-yellow-400 flex items-center justify-center bg-yellow-50/50">
            <span className="text-yellow-600 font-bold">TRANSITION SPACE</span>
        </div>

        {/* Section 2: Split View (Bottom of Sketch) */}
        <div className="h-screen flex items-center pointer-events-auto border-4 border-blue-500 relative">
          <div className="absolute top-4 left-4 bg-blue-500 text-white px-2 py-1 text-xs font-bold">SECTION 2: TWO COLUMNS</div>
          
          {/* Left Side: Model Area */}
          <div className="w-1/2 h-full flex items-center justify-center relative border-r-4 border-blue-200 border-dashed bg-blue-50/30">
             <div className="absolute top-4 left-4 text-blue-400 font-bold text-sm">LEFT COLUMN (3D)</div>
             {/* Visual Guide for Target Position */}
             <div 
                className="absolute w-64 h-64 border-4 border-blue-400 border-dashed rounded-full flex items-center justify-center opacity-50 transition-opacity duration-500"
                style={{ opacity: moveProgress }}
             >
                <span className="text-blue-500 font-mono text-sm font-bold text-center">3D MODEL<br/>(MOVED LEFT)</span>
             </div>
          </div>

          {/* Right Side: Text Content */}
          <div className="w-1/2 h-full flex items-center justify-center px-12 border-l-4 border-purple-200 border-dashed bg-purple-50/30">
            <div className="absolute top-4 right-4 text-purple-400 font-bold text-sm">RIGHT COLUMN (TEXT)</div>
            <div 
              className="max-w-xl bg-white border-4 border-black p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all duration-500 transform"
              style={{ 
                opacity: moveProgress >= 0.8 ? 1 : 0,
                transform: `translateY(${moveProgress >= 0.8 ? 0 : 20}px)`
              }}
            >
              <h2 className="text-5xl font-bold mb-6 text-black uppercase decoration-4 underline-offset-4 border-b-4 border-black pb-2">
                Text
              </h2>
              <div className="space-y-4 font-mono text-lg">
                <p>
                  This section corresponds to the right side of your sketch.
                </p>
                <p className="text-gray-600">
                  The 3D model has moved to the left &lt;3d&gt;, creating space for this narrative content.
                </p>
                <div className="h-4 bg-gray-200 w-3/4"></div>
                <div className="h-4 bg-gray-200 w-1/2"></div>
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