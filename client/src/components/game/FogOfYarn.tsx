import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRocketKittens } from "@/lib/stores/useRocketKittens";
import { 
  KalmanFilter, 
  ParticleFilter,
  StateEstimate,
  generateNoisyMeasurement,
  isOccluded,
  DEFAULT_KALMAN_CONFIG,
  DEFAULT_PARTICLE_CONFIG,
} from "@/lib/ai/sensorFusion";
import { Vector2D } from "@/lib/physics/ballistics";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type FilterType = "kalman" | "particle";

export function FogOfYarnPanel() {
  const {
    players,
    currentPlayerId,
  } = useRocketKittens();

  const opponent = players.find(p => p.id !== currentPlayerId);

  const [enabled, setEnabled] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>("kalman");
  const [measurementNoise, setMeasurementNoise] = useState(2);
  const [occlusionProb, setOcclusionProb] = useState(0.1);
  const [updateInterval, setUpdateInterval] = useState(0.5);
  const [estimate, setEstimate] = useState<StateEstimate | null>(null);
  const [lastMeasurement, setLastMeasurement] = useState<Vector2D | null>(null);
  const [isOccludedNow, setIsOccludedNow] = useState(false);

  const kalmanRef = useRef<KalmanFilter | null>(null);
  const particleRef = useRef<ParticleFilter | null>(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (opponent && enabled) {
      kalmanRef.current = new KalmanFilter(opponent.position, {
        ...DEFAULT_KALMAN_CONFIG,
        measurementNoise,
      });
      particleRef.current = new ParticleFilter(opponent.position, {
        ...DEFAULT_PARTICLE_CONFIG,
        measurementNoise,
      });
    }
  }, [enabled, opponent?.position.x, opponent?.position.y, measurementNoise]);

  const updateEstimate = useCallback(() => {
    if (!enabled || !opponent) return;
    
    const now = performance.now() / 1000;
    if (now - lastUpdateRef.current < updateInterval) return;
    lastUpdateRef.current = now;
    
    const occluded = isOccluded(occlusionProb);
    setIsOccludedNow(occluded);
    
    const measurement = generateNoisyMeasurement(
      opponent.position,
      measurementNoise,
      now,
      occluded
    );
    
    if (measurement) {
      setLastMeasurement(measurement.position);
      
      if (filterType === "kalman" && kalmanRef.current) {
        kalmanRef.current.update(measurement);
        setEstimate(kalmanRef.current.getEstimate());
      } else if (filterType === "particle" && particleRef.current) {
        particleRef.current.update(measurement);
        setEstimate(particleRef.current.getEstimate());
      }
    } else {
      if (filterType === "kalman" && kalmanRef.current) {
        kalmanRef.current.predict(updateInterval);
        setEstimate(kalmanRef.current.getEstimate());
      } else if (filterType === "particle" && particleRef.current) {
        particleRef.current.predict(updateInterval);
        setEstimate(particleRef.current.getEstimate());
      }
    }
  }, [enabled, opponent, filterType, measurementNoise, occlusionProb, updateInterval]);

  useEffect(() => {
    if (!enabled) return;
    
    const interval = setInterval(updateEstimate, updateInterval * 1000);
    return () => clearInterval(interval);
  }, [enabled, updateEstimate, updateInterval]);

  if (!opponent) {
    return (
      <div className="absolute bottom-32 right-4 w-80 bg-black/85 rounded-xl p-4 text-white pointer-events-auto">
        <h3 className="text-lg font-bold text-cyan-400 mb-2">Fog of Yarn</h3>
        <p className="text-sm text-white/60">No opponent to track.</p>
      </div>
    );
  }

  const truePosition = opponent.position;
  const error = estimate 
    ? Math.sqrt((estimate.position.x - truePosition.x) ** 2 + 
                (estimate.position.y - truePosition.y) ** 2)
    : 0;

  return (
    <div className="absolute bottom-32 right-4 w-80 bg-black/85 rounded-xl p-4 text-white pointer-events-auto max-h-[50vh] overflow-y-auto">
      <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
        <span className="text-xl">📡</span> Fog of Yarn
      </h3>
      
      <div className="space-y-4">
        <div className="bg-cyan-900/30 rounded-lg p-3 text-sm">
          <p className="text-cyan-200">
            Target position is uncertain. Use sensor fusion to estimate 
            the opponent's true position.
          </p>
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded"
          />
          <span>Enable Fog Mode</span>
        </label>
        
        {enabled && (
          <>
            <div className="space-y-2">
              <div className="text-sm font-bold">Filter Type</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => setFilterType("kalman")}
                  className={cn(
                    "text-xs",
                    filterType === "kalman" 
                      ? "bg-cyan-600" 
                      : "bg-gray-800 hover:bg-gray-700"
                  )}
                >
                  Kalman Filter
                </Button>
                <Button
                  onClick={() => setFilterType("particle")}
                  className={cn(
                    "text-xs",
                    filterType === "particle" 
                      ? "bg-cyan-600" 
                      : "bg-gray-800 hover:bg-gray-700"
                  )}
                >
                  Particle Filter
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Measurement Noise</span>
                <span className="font-mono text-cyan-300">{measurementNoise.toFixed(1)}m</span>
              </div>
              <Slider
                value={[measurementNoise]}
                onValueChange={([val]) => setMeasurementNoise(val)}
                min={0.5}
                max={5}
                step={0.1}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Occlusion Probability</span>
                <span className="font-mono text-cyan-300">{(occlusionProb * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[occlusionProb]}
                onValueChange={([val]) => setOcclusionProb(val)}
                min={0}
                max={0.5}
                step={0.05}
                className="w-full"
              />
            </div>
            
            <div className="border-t border-white/20 pt-3">
              <div className="text-sm font-bold mb-2">Estimation Status</div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/10 rounded p-2">
                  <div className="text-white/60">Sensor</div>
                  <div className={`text-lg font-bold ${isOccludedNow ? "text-red-400" : "text-green-400"}`}>
                    {isOccludedNow ? "Occluded" : "Active"}
                  </div>
                </div>
                
                <div className="bg-white/10 rounded p-2">
                  <div className="text-white/60">Confidence</div>
                  <div className={cn(
                    "text-lg font-bold",
                    (estimate?.confidence || 0) > 0.7 ? "text-green-400" :
                    (estimate?.confidence || 0) > 0.4 ? "text-yellow-400" : "text-red-400"
                  )}>
                    {((estimate?.confidence || 0) * 100).toFixed(0)}%
                  </div>
                </div>
                
                <div className="bg-white/10 rounded p-2">
                  <div className="text-white/60">Position Error</div>
                  <div className={cn(
                    "text-lg font-bold",
                    error < 1 ? "text-green-400" :
                    error < 3 ? "text-yellow-400" : "text-red-400"
                  )}>
                    {error.toFixed(2)}m
                  </div>
                </div>
                
                <div className="bg-white/10 rounded p-2">
                  <div className="text-white/60">Uncertainty</div>
                  <div className="text-lg font-bold">
                    ±{(estimate?.uncertainty.positionX || 0).toFixed(1)}m
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      <div className="mt-4 text-xs text-white/50 border-t border-white/20 pt-3">
        <div className="font-bold mb-1">Sensor Fusion</div>
        <p>
          {filterType === "kalman" 
            ? "Kalman filter: Optimal for linear Gaussian systems. Fast and efficient."
            : "Particle filter: Handles non-linear dynamics. More robust but computationally heavier."
          }
        </p>
      </div>
    </div>
  );
}

interface UncertaintyVisualizationProps {
  estimate: StateEstimate;
  truePosition: Vector2D;
  showTrue?: boolean;
}

export function UncertaintyVisualization({ 
  estimate, 
  truePosition,
  showTrue = false 
}: UncertaintyVisualizationProps) {
  const ellipseRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (ellipseRef.current) {
      ellipseRef.current.scale.x = estimate.uncertainty.positionX * 2;
      ellipseRef.current.scale.y = estimate.uncertainty.positionY * 2;
    }
  });

  return (
    <group>
      <mesh 
        ref={ellipseRef}
        position={[estimate.position.x, estimate.position.y, 0.1]}
      >
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial 
          color="#00ffff" 
          transparent 
          opacity={0.2}
        />
      </mesh>
      
      <mesh position={[estimate.position.x, estimate.position.y, 0.2]}>
        <ringGeometry args={[0.15, 0.2, 16]} />
        <meshBasicMaterial color="#00ffff" />
      </mesh>
      
      {showTrue && (
        <mesh position={[truePosition.x, truePosition.y, 0.15]}>
          <ringGeometry args={[0.1, 0.15, 16]} />
          <meshBasicMaterial color="#ff0000" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

interface ParticleVisualizationProps {
  particles: Vector2D[];
}

export function ParticleVisualization({ particles }: ParticleVisualizationProps) {
  const positions = useMemo(() => {
    const arr = new Float32Array(particles.length * 3);
    particles.forEach((p, i) => {
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = 0.1;
    });
    return arr;
  }, [particles]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        color="#00ffff" 
        size={0.1} 
        transparent 
        opacity={0.6}
      />
    </points>
  );
}

interface RadarSweepProps {
  center: Vector2D;
  range: number;
}

export function RadarSweep({ center, range }: RadarSweepProps) {
  const sweepRef = useRef<THREE.Mesh>(null);
  const [angle, setAngle] = useState(0);

  useFrame((_, delta) => {
    setAngle(a => (a + delta * 2) % (Math.PI * 2));
    if (sweepRef.current) {
      sweepRef.current.rotation.z = angle;
    }
  });

  return (
    <group position={[center.x, center.y, 0.05]}>
      <mesh>
        <ringGeometry args={[range - 0.1, range, 32]} />
        <meshBasicMaterial color="#00ff00" transparent opacity={0.3} />
      </mesh>
      
      <mesh ref={sweepRef}>
        <circleGeometry args={[range, 2, 0, 0.3]} />
        <meshBasicMaterial color="#00ff00" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
