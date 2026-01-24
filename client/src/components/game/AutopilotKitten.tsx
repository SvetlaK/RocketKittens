import { useState, useEffect, useCallback, useMemo } from "react";
import { useRocketKittens } from "@/lib/stores/useRocketKittens";
import { 
  QLearningAgent, 
  SupervisedAgent, 
  RLState,
  DEFAULT_RL_CONFIG,
} from "@/lib/ai/reinforcement";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AIMode = "off" | "supervised" | "rl";

const rlAgent = new QLearningAgent(DEFAULT_RL_CONFIG);
const supervisedAgent = new SupervisedAgent();

export function AutopilotPanel() {
  const {
    players,
    currentPlayerId,
    physicsConfig,
    terrainHeight,
    maxVelocity,
    phase,
    setAngle,
    setPower,
    setPhase,
    getOpponent,
  } = useRocketKittens();

  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const opponent = players.find(p => p.id !== currentPlayerId);

  const [aiMode, setAiMode] = useState<AIMode>("off");
  const [suggestedAction, setSuggestedAction] = useState<{ angle: number; power: number } | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [stats, setStats] = useState({
    rlExplorationRate: rlAgent.getExplorationRate(),
    rlGamesPlayed: 0,
    supervisedGamesPlayed: 0,
  });

  const getCurrentState = useCallback((): RLState | null => {
    if (!currentPlayer || !opponent) return null;
    
    return {
      playerX: currentPlayer.position.x,
      playerY: currentPlayer.position.y,
      opponentX: opponent.position.x,
      opponentY: opponent.position.y,
      wind: physicsConfig.windSpeed,
      playerHealth: currentPlayer.health,
      opponentHealth: opponent.health,
    };
  }, [currentPlayer, opponent, physicsConfig.windSpeed]);

  const calculateSuggestion = useCallback(() => {
    if (aiMode === "off" || phase !== "aiming") return;
    
    const state = getCurrentState();
    if (!state) return;
    
    setIsThinking(true);
    
    setTimeout(() => {
      let action;
      
      if (aiMode === "supervised") {
        action = supervisedAgent.selectAction(
          state,
          physicsConfig,
          terrainHeight,
          maxVelocity
        );
      } else {
        action = rlAgent.selectAction(state);
      }
      
      setSuggestedAction(action);
      setIsThinking(false);
    }, 100);
  }, [aiMode, phase, getCurrentState, physicsConfig, terrainHeight, maxVelocity]);

  useEffect(() => {
    if (phase === "aiming" && aiMode !== "off") {
      calculateSuggestion();
    }
  }, [phase, aiMode, calculateSuggestion]);

  const applySuggestion = useCallback(() => {
    if (!suggestedAction || !currentPlayer) return;
    
    setAngle(currentPlayer.id, suggestedAction.angle);
    setPower(currentPlayer.id, suggestedAction.power);
  }, [suggestedAction, currentPlayer, setAngle, setPower]);

  const autoFire = useCallback(() => {
    if (!suggestedAction || !currentPlayer) return;
    
    setAngle(currentPlayer.id, suggestedAction.angle);
    setPower(currentPlayer.id, suggestedAction.power);
    
    setTimeout(() => {
      setPhase("shooting");
    }, 100);
  }, [suggestedAction, currentPlayer, setAngle, setPower, setPhase]);

  if (!currentPlayer || !opponent) return null;

  return (
    <div className="absolute top-20 left-4 w-80 bg-black/85 rounded-xl p-4 text-white pointer-events-auto max-h-[70vh] overflow-y-auto">
      <h3 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-2">
        <span className="text-xl">🤖</span> Autopilot Kitten
      </h3>
      
      <div className="space-y-4">
        <div className="bg-yellow-900/30 rounded-lg p-3 text-sm">
          <p className="text-yellow-200">
            AI-powered aiming assistance. Choose between a pre-trained solver 
            or a learning agent.
          </p>
        </div>
        
        <div className="space-y-2">
          <div className="text-sm font-bold">AI Mode</div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => setAiMode("off")}
              className={cn(
                "text-xs",
                aiMode === "off" 
                  ? "bg-gray-600" 
                  : "bg-gray-800 hover:bg-gray-700"
              )}
            >
              Off
            </Button>
            <Button
              onClick={() => setAiMode("supervised")}
              className={cn(
                "text-xs",
                aiMode === "supervised" 
                  ? "bg-blue-600" 
                  : "bg-gray-800 hover:bg-gray-700"
              )}
            >
              Solver
            </Button>
            <Button
              onClick={() => setAiMode("rl")}
              className={cn(
                "text-xs",
                aiMode === "rl" 
                  ? "bg-green-600" 
                  : "bg-gray-800 hover:bg-gray-700"
              )}
            >
              RL Agent
            </Button>
          </div>
        </div>
        
        {aiMode !== "off" && (
          <>
            <div className="border-t border-white/20 pt-3">
              <div className="text-sm font-bold mb-2">
                {isThinking ? "Thinking..." : "Suggested Action"}
              </div>
              
              {suggestedAction && !isThinking && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-white/60">Angle</div>
                    <div className="text-lg font-bold text-yellow-400">
                      {suggestedAction.angle.toFixed(0)}°
                    </div>
                  </div>
                  
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-white/60">Power</div>
                    <div className="text-lg font-bold text-yellow-400">
                      {suggestedAction.power.toFixed(0)}%
                    </div>
                  </div>
                </div>
              )}
              
              {phase === "aiming" && suggestedAction && (
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={applySuggestion}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-xs"
                  >
                    Apply Settings
                  </Button>
                  <Button
                    onClick={autoFire}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-xs"
                  >
                    Auto Fire!
                  </Button>
                </div>
              )}
            </div>
            
            <div className="border-t border-white/20 pt-3">
              <div className="text-sm font-bold mb-2">Agent Stats</div>
              
              {aiMode === "supervised" && (
                <div className="text-xs text-white/70">
                  <p>Supervised baseline uses optimal trajectory solving.</p>
                  <p className="mt-1">Always picks the best angle/power combination.</p>
                </div>
              )}
              
              {aiMode === "rl" && (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/60">Exploration Rate</span>
                    <span className="font-mono">
                      {(stats.rlExplorationRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-full rounded-full transition-all"
                      style={{ width: `${stats.rlExplorationRate * 100}%` }}
                    />
                  </div>
                  <p className="text-white/50 mt-2">
                    The RL agent learns from experience. Higher exploration = more random shots.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
        
        <Button
          onClick={calculateSuggestion}
          disabled={aiMode === "off" || isThinking}
          className="w-full bg-gray-700 hover:bg-gray-600 text-xs"
        >
          Recalculate
        </Button>
      </div>
      
      <div className="mt-4 text-xs text-white/50 border-t border-white/20 pt-3">
        <div className="font-bold mb-1">
          {aiMode === "supervised" ? "Supervised Learning" : "Reinforcement Learning"}
        </div>
        <p>
          {aiMode === "supervised" 
            ? "Learns from optimal solver demonstrations using grid search."
            : "Q-learning agent that improves through trial and error gameplay."
          }
        </p>
      </div>
    </div>
  );
}

interface LearningCurveProps {
  data: { episode: number; reward: number }[];
}

export function LearningCurve({ data }: LearningCurveProps) {
  if (data.length < 2) return null;

  const maxReward = Math.max(...data.map(d => d.reward));
  const minReward = Math.min(...data.map(d => d.reward));
  const range = maxReward - minReward || 1;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.reward - minReward) / range) * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="bg-black/50 rounded p-2">
      <div className="text-xs text-white/60 mb-1">Learning Progress</div>
      <svg viewBox="0 0 100 50" className="w-full h-12">
        <polyline
          points={points}
          fill="none"
          stroke="#4ade80"
          strokeWidth="1"
        />
      </svg>
      <div className="flex justify-between text-xs text-white/40">
        <span>Episode 1</span>
        <span>Episode {data.length}</span>
      </div>
    </div>
  );
}
