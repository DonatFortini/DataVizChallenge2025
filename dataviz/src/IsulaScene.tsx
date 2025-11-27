import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Resize, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

const BASE_URL = import.meta.env.BASE_URL;
const MODEL_URL = `${BASE_URL}Isula.glb`;

useGLTF.preload(MODEL_URL);

function InteractionRig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null!);
  useFrame((state) => {
    const targetZ = -state.pointer.x * 0.6; // more roll on horizontal move
    const targetX = -state.pointer.y * 0.6; // more pitch on vertical move
    const targetY = state.pointer.x * 0.3;  // gentle yaw on horizontal move
    if (group.current) {
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.12);
      group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, targetZ, 0.12);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, 0.1);
    }
  });
  return <group ref={group}>{children}</group>;
}

type ModelProps = {
  url: string;
  playAnimation?: boolean;
};

function Model({ url, playAnimation = false }: ModelProps) {
  const { scene, animations } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const { actions, names } = useAnimations(animations, clonedScene);
  const ref = useRef<THREE.Group>(null!);
  const primaryName = names[0];

  useEffect(() => {
    if (!primaryName) return;
    const action = actions[primaryName];
    if (!action) return;

    if (playAnimation) {
      action.reset();
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = true;
      action.enabled = true;
      action.paused = false;
      action.play();
    } else {
      action.stop();
      action.reset();
      action.time = 0; // ensure first frame when paused
    }

    return () => action.stop();
  }, [actions, playAnimation, primaryName]);

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

const ModelGroup = ({ playAnimation = false }: { playAnimation?: boolean }) => (
  <group position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
    <InteractionRig>
      <Model url={MODEL_URL} playAnimation={playAnimation} />
    </InteractionRig>
  </group>
);

export default function IsulaScene({ playAnimation = false }: { playAnimation?: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }} className="w-full h-full">
      <SceneLights />
      <Suspense fallback={null}>
        <ModelGroup playAnimation={playAnimation} />
        <Environment preset="forest" />
      </Suspense>
    </Canvas>
  );
}
