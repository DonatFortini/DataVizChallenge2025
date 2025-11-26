import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Resize } from '@react-three/drei';
import * as THREE from 'three';

const BASE_URL = import.meta.env.BASE_URL;
const MODEL_URL = `${BASE_URL}Isula.glb`;

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

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const ref = useRef<THREE.Group>(null!);
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

const ModelGroup = () => (
  <group position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
    <InteractionRig>
      <Model url={MODEL_URL} />
    </InteractionRig>
  </group>
);

export default function IsulaScene() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      <SceneLights />
      <Suspense fallback={null}>
        <ModelGroup />
        <Environment preset="forest" />
      </Suspense>
    </Canvas>
  );
}
