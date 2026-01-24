import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRocketKittens } from "@/lib/stores/useRocketKittens";
import { 
  simulateGuidedTrajectory, 
  calculateReachableArea,
  GuidanceConfig,
  DEFAULT_GUIDANCE_CONFIG,
  GuidedTrajectoryResult,
} from "@/lib/physics/guidance";
import { calculateInitialVelocity, calculateDamage, Vector2D } from "@/lib/physics/ballistics";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface SmartYarnBallProps {
  result: GuidedTrajectoryResult;
  color?: string;
  onComplete?: () => void;
  playbackSpeed?: number;
}

export function SmartYarnBall({ 
  result, 
  color = "#9b59b6", 
  onComplete,
  playbackSpeed = 1
}: SmartYarnBallProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  const yarnColor = useMemo(() => new THREE.Color(color), [color]);
  const impulseColor = useMemo(() => new THREE.Color("#00ff00"), []);

  const impulseIndices = useMemo(() => {
    return result.impulses.map(imp => {
      const idx = result.trajectory.findIndex(t => t.time >= imp.time);
      return idx >= 0 ? idx : 0;
    });
  }, [result]);

  useFrame((_, delta) => {
    if (isComplete || !result.trajectory.length) return;
    
    const nextIndex = Math.min(
      currentIndex + Math.ceil(playbackSpeed * delta * 60),
      result.trajectory.length - 1
    );
    
    if (nextIndex !== currentIndex) {
      setCurrentIndex(nextIndex);
      
      if (meshRef.current && result.trajectory[nextIndex]) {
        const point = result.trajectory[nextIndex];
        meshRef.current.position.set(point.position.x, point.position.y, 0);
        meshRef.current.rotation.x += delta * 10;
        meshRef.current.rotation.z += delta * 8;
      }
    }
    
    if (nextIndex >= result.trajectory.length - 1 && !isComplete) {
      setIsComplete(true);
      onComplete?.();
    }
  });

  if (!result.trajectory.length || isComplete) return null;

  const currentPoint = result.trajectory[currentIndex];

  return (
    <group position={[currentPoint.position.x, currentPoint.position.y, 0]}>
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial 
          color={yarnColor}
          emissive={yarnColor}
          emissiveIntensity={0.3}
        />
      </mesh>
      
      {[0, 1, 2].map((i) => (
        <mesh 
          key={i} 
          rotation={[i * 1.2, i * 0.8, i * 0.5]}
        >
          <torusGeometry args={[0.25, 0.04, 8, 16]} />
          <meshStandardMaterial color={yarnColor} />
        </mesh>
      ))}
      
      <pointLight color={yarnColor} intensity={2} distance={3} />
      
      {impulseIndices.map((idx, i) => (
        currentIndex >= idx && currentIndex < idx + 20 && (
          <ImpulseEffect 
            key={i}
            direction={result.impulses[i].direction}
            intensity={(idx + 20 - currentIndex) / 20}
          />
        )
      ))}
    </group>
  );
}

interface ImpulseEffectProps {
  direction: Vector2D;
  intensity: number;
}

function ImpulseEffect({ direction, intensity }: ImpulseEffectProps) {
  return (
    <group>
      <mesh 
        position={[-direction.x * 0.5, -direction.y * 0.5, 0]}
        rotation={[0, 0, Math.atan2(direction.y, direction.x)]}
      >
        <coneGeometry args={[0.15 * intensity, 0.4 * intensity, 8]} />
        <meshBasicMaterial 
          color="#00ff00" 
          transparent 
          opacity={intensity * 0.8}
        />
      </mesh>
      
      <pointLight 
        color="#00ff00" 
        intensity={intensity * 3} 
        distance={2}
      />
    </group>
  );
}

export function SmartYarnPanel() {
  const {
    players,
    currentPlayerId,
    physicsConfig,
    terrainHeight,
    maxVelocity,
    getPlayerCollisionBox,
  } = useRocketKittens();

  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const opponent = players.find(p => p.id !== currentPlayerId);

  const [guidanceConfig, setGuidanceConfig] = useState<GuidanceConfig>(DEFAULT_GUIDANCE_CONFIG);
  const [previewResult, setPreviewResult] = useState<GuidedTrajectoryResult | null>(null);

  const updatePreview = useCallback(() => {
    if (!currentPlayer || !opponent) return;
    
    const targetBox = getPlayerCollisionBox(opponent.id);
    const initialVelocity = calculateInitialVelocity(
      currentPlayer.angle,
      currentPlayer.power,
      maxVelocity
    );
    
    const result = simulateGuidedTrajectory(
      currentPlayer.position,
      initialVelocity,
      targetBox,
      physicsConfig,
      guidanceConfig,
      terrainHeight
    );
    
    setPreviewResult(result);
  }, [currentPlayer, opponent, physicsConfig, guidanceConfig, terrainHeight, maxVelocity, getPlayerCollisionBox]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  if (!currentPlayer || !opponent) return null;

  return (
    <div className="absolute top-20 right-4 w-80 bg-black/85 rounded-xl p-4 text-white pointer-events-auto max-h-[70vh] overflow-y-auto">
      <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
        <span className="text-xl">🎯</span> Smart Yarn (MPC Guided)
      </h3>
      
      <div className="space-y-4">
        <div className="bg-purple-900/30 rounded-lg p-3 text-sm">
          <p className="text-purple-200">
            Mid-flight course correction using Model Predictive Control. 
            The yarn ball can adjust its trajectory to hit the target.
          </p>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Max Impulses</span>
            <span className="font-mono text-purple-300">{guidanceConfig.maxImpulses}</span>
          </div>
          <Slider
            value={[guidanceConfig.maxImpulses]}
            onValueChange={([val]) => setGuidanceConfig(c => ({ ...c, maxImpulses: val }))}
            min={1}
            max={5}
            step={1}
            className="w-full"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Impulse Strength</span>
            <span className="font-mono text-purple-300">{guidanceConfig.impulseStrength} m/s</span>
          </div>
          <Slider
            value={[guidanceConfig.impulseStrength]}
            onValueChange={([val]) => setGuidanceConfig(c => ({ ...c, impulseStrength: val }))}
            min={1}
            max={10}
            step={0.5}
            className="w-full"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Correction Interval</span>
            <span className="font-mono text-purple-300">{guidanceConfig.correctionInterval}s</span>
          </div>
          <Slider
            value={[guidanceConfig.correctionInterval]}
            onValueChange={([val]) => setGuidanceConfig(c => ({ ...c, correctionInterval: val }))}
            min={0.1}
            max={1}
            step={0.1}
            className="w-full"
          />
        </div>
        
        <Button
          onClick={updatePreview}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          Preview Guided Trajectory
        </Button>
        
        {previewResult && (
          <div className="border-t border-white/20 pt-3 space-y-2">
            <div className="text-sm font-bold text-green-400">Prediction</div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/10 rounded p-2">
                <div className="text-white/60">Will Hit?</div>
                <div className={`text-lg font-bold ${previewResult.hitTarget ? "text-green-400" : "text-red-400"}`}>
                  {previewResult.hitTarget ? "Yes" : "No"}
                </div>
              </div>
              
              <div className="bg-white/10 rounded p-2">
                <div className="text-white/60">Impulses Used</div>
                <div className="text-lg font-bold">
                  {previewResult.impulses.length} / {guidanceConfig.maxImpulses}
                </div>
              </div>
            </div>
            
            {previewResult.impulses.length > 0 && (
              <div className="text-xs text-white/70">
                <div className="font-bold mb-1">Corrections:</div>
                {previewResult.impulses.map((imp, i) => (
                  <div key={i} className="flex justify-between">
                    <span>t={imp.time.toFixed(2)}s</span>
                    <span>Δv={imp.magnitude.toFixed(1)} m/s</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="mt-4 text-xs text-white/50 border-t border-white/20 pt-3">
        <div className="font-bold mb-1">Model Predictive Control</div>
        <p>Uses proportional navigation to calculate optimal course corrections while respecting actuator constraints.</p>
      </div>
    </div>
  );
}

interface ReachableAreaVisualizationProps {
  position: Vector2D;
  velocity: Vector2D;
  remainingImpulses: number;
  physicsConfig: typeof import("@/lib/physics/ballistics").DEFAULT_PHYSICS_CONFIG;
  guidanceConfig: GuidanceConfig;
  terrainHeight: number;
}

export function ReachableAreaVisualization({
  position,
  velocity,
  remainingImpulses,
  physicsConfig,
  guidanceConfig,
  terrainHeight,
}: ReachableAreaVisualizationProps) {
  const trajectories = useMemo(() => {
    return calculateReachableArea(
      position,
      velocity,
      remainingImpulses,
      physicsConfig,
      guidanceConfig,
      terrainHeight,
      8
    );
  }, [position, velocity, remainingImpulses, physicsConfig, guidanceConfig, terrainHeight]);

  return (
    <group>
      {trajectories.map((traj, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={traj.length}
              array={new Float32Array(traj.flatMap(p => [p.x, p.y, 0]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial 
            color="#00ff00" 
            opacity={0.3} 
            transparent 
          />
        </line>
      ))}
    </group>
  );
}
