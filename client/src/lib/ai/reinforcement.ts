// Reinforcement Learning module for Autopilot Kitten
// Implements Q-learning policy for aiming decisions

import { 
  Vector2D, 
  PhysicsConfig, 
  simulateTrajectory,
  calculateDamage,
  CollisionBox,
} from "../physics/ballistics";

export interface RLState {
  playerX: number;
  playerY: number;
  opponentX: number;
  opponentY: number;
  wind: number;
  playerHealth: number;
  opponentHealth: number;
}

export interface RLAction {
  angle: number;  // 0-180 degrees
  power: number;  // 0-100 percent
}

export interface Experience {
  state: RLState;
  action: RLAction;
  reward: number;
  nextState: RLState;
  done: boolean;
}

export interface PolicyNetwork {
  weights: number[][][];
  biases: number[][];
}

export interface RLConfig {
  learningRate: number;
  discountFactor: number;
  explorationRate: number;
  explorationDecay: number;
  minExploration: number;
  batchSize: number;
}

export const DEFAULT_RL_CONFIG: RLConfig = {
  learningRate: 0.001,
  discountFactor: 0.99,
  explorationRate: 1.0,
  explorationDecay: 0.995,
  minExploration: 0.01,
  batchSize: 32,
};

// Discretize state for tabular Q-learning
function discretizeState(state: RLState): string {
  const windBucket = Math.round(state.wind / 2);
  const distX = Math.round((state.opponentX - state.playerX) / 5);
  const distY = Math.round((state.opponentY - state.playerY) / 2);
  
  return `${distX},${distY},${windBucket}`;
}

// Discretize action space
function discretizeAction(action: RLAction): string {
  const angleBucket = Math.round(action.angle / 5);
  const powerBucket = Math.round(action.power / 10);
  
  return `${angleBucket},${powerBucket}`;
}

// Parse discretized action back to continuous
function parseAction(actionKey: string): RLAction {
  const [angleBucket, powerBucket] = actionKey.split(",").map(Number);
  return {
    angle: angleBucket * 5,
    power: powerBucket * 10,
  };
}

// Q-Learning Agent for Autopilot Kitten
export class QLearningAgent {
  private qTable: Map<string, Map<string, number>>;
  private config: RLConfig;
  private explorationRate: number;
  private replayBuffer: Experience[];
  private trainingStats: { episode: number; reward: number; wins: number }[];

  constructor(config: RLConfig = DEFAULT_RL_CONFIG) {
    this.qTable = new Map();
    this.config = config;
    this.explorationRate = config.explorationRate;
    this.replayBuffer = [];
    this.trainingStats = [];
  }

  // Get Q-value for state-action pair
  private getQValue(stateKey: string, actionKey: string): number {
    const stateQ = this.qTable.get(stateKey);
    if (!stateQ) return 0;
    return stateQ.get(actionKey) || 0;
  }

  // Set Q-value for state-action pair
  private setQValue(stateKey: string, actionKey: string, value: number): void {
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map());
    }
    this.qTable.get(stateKey)!.set(actionKey, value);
  }

  // Get all possible actions (discretized)
  private getActionSpace(): string[] {
    const actions: string[] = [];
    for (let angle = 0; angle <= 180; angle += 5) {
      for (let power = 10; power <= 100; power += 10) {
        actions.push(`${angle / 5},${power / 10}`);
      }
    }
    return actions;
  }

  // Select action using epsilon-greedy policy
  selectAction(state: RLState): RLAction {
    const stateKey = discretizeState(state);
    
    // Exploration
    if (Math.random() < this.explorationRate) {
      return {
        angle: Math.random() * 180,
        power: 10 + Math.random() * 90,
      };
    }
    
    // Exploitation - find best action
    const actions = this.getActionSpace();
    let bestAction = actions[0];
    let bestValue = -Infinity;
    
    for (const action of actions) {
      const value = this.getQValue(stateKey, action);
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }
    
    return parseAction(bestAction);
  }

  // Update Q-value using TD learning
  update(experience: Experience): void {
    this.replayBuffer.push(experience);
    
    const stateKey = discretizeState(experience.state);
    const actionKey = discretizeAction(experience.action);
    
    // Calculate target
    let target = experience.reward;
    if (!experience.done) {
      const nextStateKey = discretizeState(experience.nextState);
      const actions = this.getActionSpace();
      let maxNextQ = -Infinity;
      
      for (const action of actions) {
        const value = this.getQValue(nextStateKey, action);
        if (value > maxNextQ) {
          maxNextQ = value;
        }
      }
      
      target += this.config.discountFactor * maxNextQ;
    }
    
    // Update Q-value
    const currentQ = this.getQValue(stateKey, actionKey);
    const newQ = currentQ + this.config.learningRate * (target - currentQ);
    this.setQValue(stateKey, actionKey, newQ);
    
    // Decay exploration
    this.explorationRate = Math.max(
      this.config.minExploration,
      this.explorationRate * this.config.explorationDecay
    );
  }

  // Calculate reward from shot result
  static calculateReward(
    hit: boolean,
    damage: number,
    opponentHealthBefore: number,
    opponentHealthAfter: number,
    playerWon: boolean
  ): number {
    let reward = 0;
    
    if (hit) {
      reward += 10;
      reward += damage * 0.5;
    } else {
      reward -= 1;
    }
    
    if (playerWon) {
      reward += 50;
    }
    
    if (opponentHealthAfter <= 0) {
      reward += 30;
    }
    
    return reward;
  }

  // Get training statistics
  getStats(): typeof this.trainingStats {
    return this.trainingStats;
  }

  // Record episode stats
  recordEpisode(reward: number, won: boolean): void {
    this.trainingStats.push({
      episode: this.trainingStats.length + 1,
      reward,
      wins: won ? 1 : 0,
    });
  }

  // Get current exploration rate
  getExplorationRate(): number {
    return this.explorationRate;
  }

  // Export policy for persistence
  exportPolicy(): object {
    const policy: Record<string, Record<string, number>> = {};
    this.qTable.forEach((actions, state) => {
      policy[state] = {};
      actions.forEach((value, action) => {
        policy[state][action] = value;
      });
    });
    return policy;
  }

  // Import policy
  importPolicy(policy: Record<string, Record<string, number>>): void {
    this.qTable.clear();
    for (const state in policy) {
      this.qTable.set(state, new Map(Object.entries(policy[state])));
    }
  }
}

// Supervised baseline agent - learns from optimal solver
export class SupervisedAgent {
  private solutionCache: Map<string, RLAction>;

  constructor() {
    this.solutionCache = new Map();
  }

  // Calculate optimal shot using physics simulation
  findOptimalShot(
    playerPos: Vector2D,
    targetBox: CollisionBox,
    physicsConfig: PhysicsConfig,
    terrainHeight: number,
    maxVelocity: number
  ): RLAction {
    const cacheKey = `${playerPos.x},${playerPos.y},${targetBox.x},${targetBox.y},${physicsConfig.windSpeed}`;
    
    if (this.solutionCache.has(cacheKey)) {
      return this.solutionCache.get(cacheKey)!;
    }
    
    let bestAction: RLAction = { angle: 45, power: 50 };
    let bestScore = -Infinity;
    
    // Grid search for optimal angle and power
    for (let angle = 10; angle <= 170; angle += 2) {
      for (let power = 20; power <= 100; power += 5) {
        const result = simulateTrajectory(
          { origin: playerPos, angle, power, maxVelocity },
          physicsConfig,
          terrainHeight,
          targetBox
        );
        
        let score = 0;
        if (result.hitTarget) {
          score = 100 + calculateDamage(result.impactVelocity);
        } else {
          // Score based on how close we got
          const targetCenter = {
            x: targetBox.x + targetBox.width / 2,
            y: targetBox.y + targetBox.height / 2,
          };
          const dist = Math.sqrt(
            (result.finalPosition.x - targetCenter.x) ** 2 +
            (result.finalPosition.y - targetCenter.y) ** 2
          );
          score = Math.max(0, 50 - dist);
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestAction = { angle, power };
        }
      }
    }
    
    this.solutionCache.set(cacheKey, bestAction);
    return bestAction;
  }

  // Select action (deterministic - always picks optimal)
  selectAction(
    state: RLState,
    physicsConfig: PhysicsConfig,
    terrainHeight: number,
    maxVelocity: number
  ): RLAction {
    const playerPos = { x: state.playerX, y: state.playerY };
    const targetBox: CollisionBox = {
      x: state.opponentX - 0.5,
      y: state.opponentY - 0.5,
      width: 1,
      height: 2,
    };
    
    return this.findOptimalShot(
      playerPos,
      targetBox,
      physicsConfig,
      terrainHeight,
      maxVelocity
    );
  }
}

// Policy comparison utilities
export interface PolicyComparison {
  rlWins: number;
  supervisedWins: number;
  rlAvgReward: number;
  supervisedAvgReward: number;
  totalGames: number;
}

export function comparePolicies(
  rlStats: { reward: number; wins: number }[],
  supervisedStats: { reward: number; wins: number }[]
): PolicyComparison {
  const rlTotal = rlStats.length;
  const supervisedTotal = supervisedStats.length;
  
  return {
    rlWins: rlStats.filter(s => s.wins > 0).length,
    supervisedWins: supervisedStats.filter(s => s.wins > 0).length,
    rlAvgReward: rlStats.reduce((sum, s) => sum + s.reward, 0) / (rlTotal || 1),
    supervisedAvgReward: supervisedStats.reduce((sum, s) => sum + s.reward, 0) / (supervisedTotal || 1),
    totalGames: Math.max(rlTotal, supervisedTotal),
  };
}
