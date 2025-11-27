import { Suspense, useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Resize, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

const BASE_URL = import.meta.env.BASE_URL;
const MODEL_URL = `${BASE_URL}Isula.glb`;

console.log("IsulaScene: Initializing with MODEL_URL =", MODEL_URL);

useGLTF.preload(MODEL_URL);

function InteractionRig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null!);
  useFrame((state) => {
    const targetZ = -state.pointer.x * 0.2;
    const targetX = -state.pointer.y * 0.2;
    if (group.current) {
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.1);
      group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, targetZ, 0.1);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
    }
  });
  return <group ref={group}>{children}</group>;
}

function Model({ url, step = 0 }: { url: string, step?: number }) {
  const { scene, animations } = useGLTF(url);
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);
  
  const ref = useRef<THREE.Group>(null!);
  const { actions, names } = useAnimations(animations, ref);
  const hasPlayed = useRef(false);

  useEffect(() => {
    if (names.length > 0) {
      const action = actions[names[0]];
      if (step === 1 && action) {
        if (!hasPlayed.current) {
          action.reset();
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          action.play();
          hasPlayed.current = true;
        }
      } else {
        if (hasPlayed.current) hasPlayed.current = false;
      }
    }
  }, [step, actions, names]);

  return (
    <group ref={ref}>
      <Resize scale={4}>
        <primitive object={clonedScene} />
      </Resize>
    </group>
  );
}

const SceneLights = () => (
  <>
    <ambientLight intensity={0.5} />
    <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
    <pointLight position={[-10, -10, -10]} />
  </>
);

const ModelGroup = ({ step }: { step: number }) => (
  <group position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
    <InteractionRig>
      <Model url={MODEL_URL} step={step} />
    </InteractionRig>
  </group>
);

export default function IsulaScene({ step = 0 }: { step?: number }) {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      <SceneLights />
      <Suspense fallback={null}>
        <ModelGroup step={step} />
        <Environment preset="forest" />
      </Suspense>
    </Canvas>
  );
}
