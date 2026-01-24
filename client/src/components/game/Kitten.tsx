import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Player } from "@/lib/stores/useRocketKittens";
import { degToRad } from "@/lib/physics/ballistics";

interface KittenProps {
  player: Player;
  isActive: boolean;
}

export function Kitten({ player, isActive }: KittenProps) {
  const groupRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const earLeftRef = useRef<THREE.Mesh>(null);
  const earRightRef = useRef<THREE.Mesh>(null);
  
  const bodyColor = useMemo(() => new THREE.Color(player.color), [player.color]);
  const darkerColor = useMemo(() => {
    const c = new THREE.Color(player.color);
    c.multiplyScalar(0.7);
    return c;
  }, [player.color]);

  useFrame((state) => {
    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 3) * 0.3;
    }
    
    if (isActive && earLeftRef.current && earRightRef.current) {
      const wiggle = Math.sin(state.clock.elapsedTime * 5) * 0.1;
      earLeftRef.current.rotation.z = 0.3 + wiggle;
      earRightRef.current.rotation.z = -0.3 - wiggle;
    }
  });

  const aimAngle = player.facingRight 
    ? degToRad(player.angle)
    : degToRad(180 - player.angle);

  return (
    <group 
      ref={groupRef} 
      position={[player.position.x, player.position.y + 0.5, 0]}
      scale={player.facingRight ? [1, 1, 1] : [-1, 1, 1]}
    >
      <mesh castShadow position={[0, 0, 0]}>
        <capsuleGeometry args={[0.4, 0.6, 8, 16]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      
      <mesh castShadow position={[0, 0.8, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      
      <mesh 
        ref={earLeftRef}
        castShadow 
        position={[-0.2, 1.1, 0]}
        rotation={[0, 0, 0.3]}
      >
        <coneGeometry args={[0.12, 0.25, 4]} />
        <meshStandardMaterial color={darkerColor} />
      </mesh>
      <mesh 
        ref={earRightRef}
        castShadow 
        position={[0.2, 1.1, 0]}
        rotation={[0, 0, -0.3]}
      >
        <coneGeometry args={[0.12, 0.25, 4]} />
        <meshStandardMaterial color={darkerColor} />
      </mesh>
      
      <mesh position={[-0.12, 0.85, 0.25]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[0.12, 0.85, 0.25]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      
      <mesh position={[0, 0.72, 0.3]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#ff9999" />
      </mesh>
      
      {[-0.15, 0.15].map((x, i) => (
        <group key={i}>
          {[-1, 0, 1].map((j) => (
            <mesh 
              key={j}
              position={[x + j * 0.03, 0.75, 0.32]}
              rotation={[0, 0, j * 0.2]}
            >
              <cylinderGeometry args={[0.005, 0.005, 0.15]} />
              <meshStandardMaterial color="#333333" />
            </mesh>
          ))}
        </group>
      ))}
      
      <mesh 
        ref={tailRef}
        castShadow 
        position={[-0.3, -0.2, 0]}
        rotation={[0, 0, 0.8]}
      >
        <capsuleGeometry args={[0.08, 0.5, 4, 8]} />
        <meshStandardMaterial color={darkerColor} />
      </mesh>
      
      {isActive && (
        <AimIndicator angle={aimAngle} power={player.power} />
      )}
      
      {isActive && (
        <mesh position={[0, 1.6, 0]}>
          <ringGeometry args={[0.15, 0.2, 16]} />
          <meshBasicMaterial color="#FFD700" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

interface AimIndicatorProps {
  angle: number;
  power: number;
}

function AimIndicator({ angle, power }: AimIndicatorProps) {
  const length = 0.5 + (power / 100) * 1.5;
  
  return (
    <group rotation={[0, 0, angle]} position={[0.3, 0.8, 0]}>
      <mesh position={[length / 2, 0, 0]}>
        <boxGeometry args={[length, 0.08, 0.08]} />
        <meshStandardMaterial 
          color={new THREE.Color().setHSL(0.3 - (power / 100) * 0.3, 1, 0.5)}
          emissive={new THREE.Color().setHSL(0.3 - (power / 100) * 0.3, 1, 0.3)}
        />
      </mesh>
      
      <mesh position={[length + 0.15, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.1, 0.2, 8]} />
        <meshStandardMaterial 
          color={new THREE.Color().setHSL(0.3 - (power / 100) * 0.3, 1, 0.5)}
          emissive={new THREE.Color().setHSL(0.3 - (power / 100) * 0.3, 1, 0.3)}
        />
      </mesh>
    </group>
  );
}

interface HealthBarProps {
  player: Player;
}

export function HealthBar3D({ player }: HealthBarProps) {
  const healthPercent = player.health / player.maxHealth;
  const healthColor = new THREE.Color().setHSL(healthPercent * 0.3, 1, 0.5);
  
  return (
    <group position={[player.position.x, player.position.y + 2.5, 0]}>
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[1.2, 0.15, 0.05]} />
        <meshBasicMaterial color="#333333" />
      </mesh>
      
      <mesh position={[(healthPercent - 1) * 0.55, 0, 0]}>
        <boxGeometry args={[1.1 * healthPercent, 0.1, 0.05]} />
        <meshBasicMaterial color={healthColor} />
      </mesh>
    </group>
  );
}
