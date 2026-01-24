import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Vector2D, ShotResult } from "@/lib/physics/ballistics";

interface YarnBallProps {
  trajectory: ShotResult["trajectory"];
  color?: string;
  onComplete?: () => void;
  playbackSpeed?: number;
}

export function YarnBall({ 
  trajectory, 
  color = "#f39c12", 
  onComplete,
  playbackSpeed = 1
}: YarnBallProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  const yarnColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame((_, delta) => {
    if (isComplete || !trajectory || trajectory.length === 0) return;
    
    const nextIndex = Math.min(
      currentIndex + Math.ceil(playbackSpeed * delta * 60),
      trajectory.length - 1
    );
    
    if (nextIndex !== currentIndex) {
      setCurrentIndex(nextIndex);
      
      if (meshRef.current && trajectory[nextIndex]) {
        const point = trajectory[nextIndex];
        meshRef.current.position.set(point.position.x, point.position.y, 0);
        meshRef.current.rotation.x += delta * 10;
        meshRef.current.rotation.z += delta * 8;
      }
    }
    
    if (nextIndex >= trajectory.length - 1 && !isComplete) {
      setIsComplete(true);
      onComplete?.();
    }
  });

  if (!trajectory || trajectory.length === 0 || isComplete) return null;

  const currentPoint = trajectory[currentIndex];
  if (!currentPoint) return null;

  return (
    <group position={[currentPoint.position.x, currentPoint.position.y, 0]}>
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial 
          color={yarnColor}
          roughness={0.8}
        />
      </mesh>
      
      {[0, 1, 2].map((i) => (
        <mesh 
          key={i} 
          rotation={[i * 1.2, i * 0.8, i * 0.5]}
        >
          <torusGeometry args={[0.2, 0.03, 8, 16]} />
          <meshStandardMaterial color={yarnColor} />
        </mesh>
      ))}
      
      <YarnTrail trajectory={trajectory} currentIndex={currentIndex} color={color} />
    </group>
  );
}

interface YarnTrailProps {
  trajectory: ShotResult["trajectory"];
  currentIndex: number;
  color: string;
}

function YarnTrail({ trajectory, currentIndex, color }: YarnTrailProps) {
  const trailLength = 20;
  const startIndex = Math.max(0, currentIndex - trailLength);
  
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = startIndex; i <= currentIndex && i < trajectory.length; i++) {
      const point = trajectory[i];
      pts.push(new THREE.Vector3(point.position.x, point.position.y, 0));
    }
    return pts;
  }, [trajectory, startIndex, currentIndex]);

  if (points.length < 2) return null;

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={2} opacity={0.6} transparent />
    </line>
  );
}

interface TrajectoryPreviewProps {
  points: Vector2D[];
  color?: string;
  dashed?: boolean;
}

export function TrajectoryPreview({ 
  points, 
  color = "#ffffff",
  dashed = true 
}: TrajectoryPreviewProps) {
  const lineKey = useMemo(() => {
    return points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('|');
  }, [points]);

  if (points.length < 2) return null;

  const positionArray = new Float32Array(points.flatMap(p => [p.x, p.y, 0]));

  return (
    <primitive 
      key={lineKey}
      object={createLine(positionArray, color, dashed)} 
    />
  );
}

function createLine(positions: Float32Array, color: string, dashed: boolean): THREE.Line {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const material = new THREE.LineDashedMaterial({
    color,
    dashSize: dashed ? 0.3 : 100,
    gapSize: dashed ? 0.15 : 0,
    opacity: 0.7,
    transparent: true,
  });
  
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}

interface ActualTrajectoryProps {
  trajectory: ShotResult["trajectory"];
  color?: string;
}

export function ActualTrajectory({ trajectory, color = "#e74c3c" }: ActualTrajectoryProps) {
  if (!trajectory || trajectory.length < 2) return null;

  const linePoints = useMemo(() => {
    return trajectory.map(p => new THREE.Vector3(p.position.x, p.position.y, 0));
  }, [trajectory]);

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={linePoints.length}
            array={new Float32Array(linePoints.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} linewidth={3} />
      </line>
      
      <mesh position={[
        trajectory[trajectory.length - 1].position.x,
        trajectory[trajectory.length - 1].position.y,
        0
      ]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

interface ImpactEffectProps {
  position: Vector2D;
  hit: boolean;
}

export function ImpactEffect({ position, hit }: ImpactEffectProps) {
  const [scale, setScale] = useState(0.1);
  const [opacity, setOpacity] = useState(1);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (scale < 2) {
      setScale(s => Math.min(2, s + delta * 4));
      setOpacity(o => Math.max(0, o - delta));
    }
  });

  if (opacity <= 0) return null;

  return (
    <group ref={groupRef} position={[position.x, position.y, 0]} scale={scale}>
      <mesh>
        <ringGeometry args={[0.3, 0.5, 16]} />
        <meshBasicMaterial 
          color={hit ? "#e74c3c" : "#f39c12"} 
          opacity={opacity}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {hit && (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i / 6) * Math.PI * 2;
            const dist = 0.5;
            return (
              <mesh 
                key={i}
                position={[Math.cos(angle) * dist, Math.sin(angle) * dist, 0]}
              >
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshBasicMaterial 
                  color="#f39c12" 
                  opacity={opacity}
                  transparent
                />
              </mesh>
            );
          })}
        </>
      )}
    </group>
  );
}
