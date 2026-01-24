import { useState, useMemo, useCallback } from "react";
import { useRocketKittens } from "@/lib/stores/useRocketKittens";
import { 
  monteCarloSimulation, 
  predictTrajectory,
  ShotResult,
  Vector2D,
  CollisionBox,
} from "@/lib/physics/ballistics";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface MonteCarloResult {
  hitRate: number;
  trajectories: ShotResult[];
  heatmap: Map<string, number>;
  stats: {
    meanDistance: number;
    stdDistance: number;
    meanFlightTime: number;
    maxHeight: number;
  };
}

export function TrajectoryLabPanel() {
  const {
    players,
    currentPlayerId,
    physicsConfig,
    terrainHeight,
    maxVelocity,
    getOpponent,
    getPlayerCollisionBox,
  } = useRocketKittens();

  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const opponent = players.find(p => p.id !== currentPlayerId);

  const [numSimulations, setNumSimulations] = useState(100);
  const [windNoiseStd, setWindNoiseStd] = useState(2);
  const [angleNoiseStd, setAngleNoiseStd] = useState(1);
  const [powerNoiseStd, setPowerNoiseStd] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);

  const runSimulation = useCallback(() => {
    if (!currentPlayer || !opponent) return;
    
    setIsRunning(true);
    
    setTimeout(() => {
      const targetBox = getPlayerCollisionBox(opponent.id);
      
      const mcResult = monteCarloSimulation(
        {
          origin: currentPlayer.position,
          angle: currentPlayer.angle,
          power: currentPlayer.power,
          maxVelocity,
        },
        physicsConfig,
        terrainHeight,
        targetBox,
        numSimulations,
        windNoiseStd,
        angleNoiseStd,
        powerNoiseStd
      );
      
      const distances = mcResult.trajectories.map(t => t.distance);
      const meanDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
      const stdDistance = Math.sqrt(
        distances.reduce((sum, d) => sum + (d - meanDistance) ** 2, 0) / distances.length
      );
      
      const flightTimes = mcResult.trajectories.map(t => t.flightTime);
      const meanFlightTime = flightTimes.reduce((a, b) => a + b, 0) / flightTimes.length;
      
      const maxHeight = Math.max(...mcResult.trajectories.map(t => t.maxHeight));
      
      setResult({
        ...mcResult,
        stats: {
          meanDistance,
          stdDistance,
          meanFlightTime,
          maxHeight,
        },
      });
      
      setIsRunning(false);
    }, 50);
  }, [
    currentPlayer,
    opponent,
    physicsConfig,
    terrainHeight,
    maxVelocity,
    numSimulations,
    windNoiseStd,
    angleNoiseStd,
    powerNoiseStd,
    getPlayerCollisionBox,
  ]);

  if (!currentPlayer || !opponent) return null;

  return (
    <div className="absolute top-20 right-4 w-80 bg-black/85 rounded-xl p-4 text-white pointer-events-auto max-h-[70vh] overflow-y-auto">
      <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
        <span className="text-xl">🔬</span> Trajectory Lab
      </h3>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Simulations</span>
            <span className="font-mono text-blue-300">{numSimulations}</span>
          </div>
          <Slider
            value={[numSimulations]}
            onValueChange={([val]) => setNumSimulations(val)}
            min={10}
            max={1000}
            step={10}
            className="w-full"
          />
        </div>
        
        <div className="border-t border-white/20 pt-3">
          <div className="text-sm text-white/70 mb-2">Noise Parameters</div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Wind Noise (σ)</span>
              <span className="font-mono">{windNoiseStd.toFixed(1)} m/s</span>
            </div>
            <Slider
              value={[windNoiseStd]}
              onValueChange={([val]) => setWindNoiseStd(val)}
              min={0}
              max={5}
              step={0.1}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2 mt-2">
            <div className="flex justify-between text-xs">
              <span>Angle Noise (σ)</span>
              <span className="font-mono">{angleNoiseStd.toFixed(1)}°</span>
            </div>
            <Slider
              value={[angleNoiseStd]}
              onValueChange={([val]) => setAngleNoiseStd(val)}
              min={0}
              max={5}
              step={0.1}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2 mt-2">
            <div className="flex justify-between text-xs">
              <span>Power Noise (σ)</span>
              <span className="font-mono">{powerNoiseStd.toFixed(1)}%</span>
            </div>
            <Slider
              value={[powerNoiseStd]}
              onValueChange={([val]) => setPowerNoiseStd(val)}
              min={0}
              max={10}
              step={0.5}
              className="w-full"
            />
          </div>
        </div>
        
        <Button
          onClick={runSimulation}
          disabled={isRunning}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {isRunning ? "Running..." : `Run ${numSimulations} Simulations`}
        </Button>
        
        {result && (
          <div className="border-t border-white/20 pt-3 space-y-3">
            <div className="text-sm font-bold text-green-400">Results</div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/10 rounded p-2">
                <div className="text-white/60">Hit Rate</div>
                <div className={cn(
                  "text-lg font-bold",
                  result.hitRate > 0.5 ? "text-green-400" : 
                  result.hitRate > 0.2 ? "text-yellow-400" : "text-red-400"
                )}>
                  {(result.hitRate * 100).toFixed(1)}%
                </div>
              </div>
              
              <div className="bg-white/10 rounded p-2">
                <div className="text-white/60">Hits / Total</div>
                <div className="text-lg font-bold">
                  {Math.round(result.hitRate * numSimulations)} / {numSimulations}
                </div>
              </div>
              
              <div className="bg-white/10 rounded p-2">
                <div className="text-white/60">Avg Distance</div>
                <div className="text-lg font-bold">
                  {result.stats.meanDistance.toFixed(1)}m
                </div>
                <div className="text-white/40">±{result.stats.stdDistance.toFixed(1)}</div>
              </div>
              
              <div className="bg-white/10 rounded p-2">
                <div className="text-white/60">Avg Flight Time</div>
                <div className="text-lg font-bold">
                  {result.stats.meanFlightTime.toFixed(2)}s
                </div>
              </div>
              
              <div className="bg-white/10 rounded p-2 col-span-2">
                <div className="text-white/60">Max Height</div>
                <div className="text-lg font-bold">
                  {result.stats.maxHeight.toFixed(1)}m
                </div>
              </div>
            </div>
            
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="rounded"
              />
              Show Impact Heatmap
            </label>
          </div>
        )}
      </div>
      
      <div className="mt-4 text-xs text-white/50 border-t border-white/20 pt-3">
        <div className="font-bold mb-1">Monte Carlo Simulation</div>
        <p>Runs multiple trajectory simulations with randomized parameters to estimate hit probability and landing distribution.</p>
      </div>
    </div>
  );
}

interface HeatmapVisualizationProps {
  heatmap: Map<string, number>;
  maxCount: number;
  targetBox: CollisionBox;
}

export function HeatmapVisualization({ heatmap, maxCount, targetBox }: HeatmapVisualizationProps) {
  const cells = useMemo(() => {
    const result: { x: number; y: number; intensity: number }[] = [];
    heatmap.forEach((count, key) => {
      const [x, y] = key.split(",").map(Number);
      result.push({ x, y, intensity: count / maxCount });
    });
    return result;
  }, [heatmap, maxCount]);

  return (
    <group>
      {cells.map((cell, i) => (
        <mesh key={i} position={[cell.x + 0.5, cell.y + 0.5, 0.1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={getHeatmapColor(cell.intensity)}
            transparent
            opacity={0.4 + cell.intensity * 0.4}
          />
        </mesh>
      ))}
      
      <mesh position={[targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, 0.2]}>
        <ringGeometry args={[0.8, 1, 16]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function getHeatmapColor(intensity: number): string {
  if (intensity > 0.8) return "#ff0000";
  if (intensity > 0.6) return "#ff6600";
  if (intensity > 0.4) return "#ffcc00";
  if (intensity > 0.2) return "#99ff00";
  return "#00ff00";
}

interface TrajectoryComparisonProps {
  predicted: Vector2D[];
  actual: ShotResult["trajectory"];
}

export function TrajectoryComparison({ predicted, actual }: TrajectoryComparisonProps) {
  const predictedError = useMemo(() => {
    if (!predicted.length || !actual.length) return null;
    
    const predictedEnd = predicted[predicted.length - 1];
    const actualEnd = actual[actual.length - 1].position;
    
    const errorX = actualEnd.x - predictedEnd.x;
    const errorY = actualEnd.y - predictedEnd.y;
    const totalError = Math.sqrt(errorX ** 2 + errorY ** 2);
    
    return { errorX, errorY, totalError };
  }, [predicted, actual]);

  if (!predictedError) return null;

  return (
    <div className="bg-black/80 rounded-lg p-3 text-white text-sm">
      <div className="font-bold text-purple-400 mb-2">Trajectory Comparison</div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-white/60">X Error</div>
          <div className="font-mono">{predictedError.errorX.toFixed(2)}m</div>
        </div>
        <div>
          <div className="text-white/60">Y Error</div>
          <div className="font-mono">{predictedError.errorY.toFixed(2)}m</div>
        </div>
        <div>
          <div className="text-white/60">Total Error</div>
          <div className="font-mono font-bold text-orange-400">
            {predictedError.totalError.toFixed(2)}m
          </div>
        </div>
      </div>
    </div>
  );
}
