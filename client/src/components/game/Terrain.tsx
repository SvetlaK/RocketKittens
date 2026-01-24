import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

interface TerrainProps {
  width?: number;
  depth?: number;
  height?: number;
}

export function Terrain({ width = 50, depth = 10, height = 0.5 }: TerrainProps) {
  const grassTexture = useTexture("/textures/grass.png");
  
  useMemo(() => {
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(width / 4, depth / 4);
  }, [grassTexture, width, depth]);

  return (
    <group position={[width / 2 - 5, -height / 2, 0]}>
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial map={grassTexture} color="#4a7c23" />
      </mesh>
      
      <mesh position={[0, -height, 0]}>
        <boxGeometry args={[width, height * 2, depth]} />
        <meshStandardMaterial color="#5a4a32" />
      </mesh>
    </group>
  );
}

export function Sky() {
  const skyTexture = useTexture("/textures/sky.png");
  
  return (
    <mesh position={[20, 15, -20]} rotation={[0, 0, 0]}>
      <planeGeometry args={[100, 50]} />
      <meshBasicMaterial map={skyTexture} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function Clouds() {
  const cloudPositions = useMemo(() => {
    const positions: { x: number; y: number; scale: number }[] = [];
    for (let i = 0; i < 5; i++) {
      positions.push({
        x: i * 12 - 10,
        y: 12 + (i % 3) * 2,
        scale: 0.8 + (i % 3) * 0.3,
      });
    }
    return positions;
  }, []);

  return (
    <group>
      {cloudPositions.map((cloud, index) => (
        <group key={index} position={[cloud.x, cloud.y, -15]} scale={cloud.scale}>
          <mesh>
            <sphereGeometry args={[1.5, 16, 16]} />
            <meshStandardMaterial color="#ffffff" opacity={0.9} transparent />
          </mesh>
          <mesh position={[1.2, 0.2, 0]}>
            <sphereGeometry args={[1.2, 16, 16]} />
            <meshStandardMaterial color="#ffffff" opacity={0.9} transparent />
          </mesh>
          <mesh position={[-1.0, -0.1, 0]}>
            <sphereGeometry args={[1.0, 16, 16]} />
            <meshStandardMaterial color="#ffffff" opacity={0.9} transparent />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function WindIndicator({ windSpeed }: { windSpeed: number }) {
  const arrowLength = Math.abs(windSpeed) / 2;
  const direction = windSpeed >= 0 ? 1 : -1;
  
  return (
    <group position={[20, 18, 0]}>
      <mesh position={[direction * arrowLength / 2, 0, 0]}>
        <boxGeometry args={[arrowLength, 0.3, 0.1]} />
        <meshStandardMaterial color="#3498db" />
      </mesh>
      <mesh 
        position={[direction * arrowLength, 0, 0]} 
        rotation={[0, 0, direction > 0 ? -Math.PI / 4 : Math.PI / 4]}
      >
        <coneGeometry args={[0.3, 0.6, 8]} />
        <meshStandardMaterial color="#3498db" />
      </mesh>
    </group>
  );
}
