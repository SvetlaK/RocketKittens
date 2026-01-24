import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { 
  PhysicsConfig, 
  DEFAULT_PHYSICS_CONFIG, 
  ShotResult, 
  Vector2D,
  generateWind,
  CollisionBox,
} from "../physics/ballistics";

export type GamePhase = "menu" | "playing" | "aiming" | "shooting" | "turn_end" | "game_over";
export type PowerUpType = "normal" | "guided" | "smart";

export interface Player {
  id: number;
  name: string;
  position: Vector2D;
  health: number;
  maxHealth: number;
  angle: number;
  power: number;
  facingRight: boolean;
  color: string;
  powerUps: PowerUpType[];
  selectedPowerUp: PowerUpType;
}

export interface ShotRecord {
  id: string;
  playerId: number;
  params: {
    origin: Vector2D;
    angle: number;
    power: number;
  };
  config: PhysicsConfig;
  result: ShotResult;
  predictedTrajectory: Vector2D[];
  timestamp: number;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerId: number;
  turn: number;
  wind: number;
  physicsConfig: PhysicsConfig;
  shotHistory: ShotRecord[];
  lastShot: ShotResult | null;
  predictedTrajectory: Vector2D[];
  terrainHeight: number;
  maxVelocity: number;
  winner: number | null;
  showTrajectoryPreview: boolean;
  
  // Actions
  startGame: () => void;
  resetGame: () => void;
  setPhase: (phase: GamePhase) => void;
  
  // Player actions
  setAngle: (playerId: number, angle: number) => void;
  setPower: (playerId: number, power: number) => void;
  adjustAngle: (delta: number) => void;
  adjustPower: (delta: number) => void;
  selectPowerUp: (playerId: number, powerUp: PowerUpType) => void;
  
  // Shot actions
  recordShot: (record: Omit<ShotRecord, "id" | "timestamp">) => void;
  setLastShot: (result: ShotResult | null) => void;
  setPredictedTrajectory: (trajectory: Vector2D[]) => void;
  
  // Turn management
  endTurn: () => void;
  nextTurn: () => void;
  
  // Damage and game end
  applyDamage: (playerId: number, damage: number) => void;
  checkGameEnd: () => void;
  
  // Physics
  setWind: (wind: number) => void;
  updatePhysicsConfig: (config: Partial<PhysicsConfig>) => void;
  
  // UI
  toggleTrajectoryPreview: () => void;
  
  // Helpers
  getCurrentPlayer: () => Player;
  getOpponent: () => Player;
  getPlayerCollisionBox: (playerId: number) => CollisionBox;
}

const INITIAL_PLAYER_1: Player = {
  id: 1,
  name: "Whiskers",
  position: { x: 5, y: 2 },
  health: 100,
  maxHealth: 100,
  angle: 45,
  power: 50,
  facingRight: true,
  color: "#FF6B6B",
  powerUps: ["normal"],
  selectedPowerUp: "normal",
};

const INITIAL_PLAYER_2: Player = {
  id: 2,
  name: "Mittens",
  position: { x: 35, y: 2 },
  health: 100,
  maxHealth: 100,
  angle: 135,
  power: 50,
  facingRight: false,
  color: "#4ECDC4",
  powerUps: ["normal"],
  selectedPowerUp: "normal",
};

export const useRocketKittens = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    phase: "menu",
    players: [{ ...INITIAL_PLAYER_1 }, { ...INITIAL_PLAYER_2 }],
    currentPlayerId: 1,
    turn: 1,
    wind: 0,
    physicsConfig: { ...DEFAULT_PHYSICS_CONFIG },
    shotHistory: [],
    lastShot: null,
    predictedTrajectory: [],
    terrainHeight: 0,
    maxVelocity: 30,
    winner: null,
    showTrajectoryPreview: true,
    
    startGame: () => {
      const wind = generateWind(-8, 8);
      set({
        phase: "aiming",
        players: [{ ...INITIAL_PLAYER_1 }, { ...INITIAL_PLAYER_2 }],
        currentPlayerId: 1,
        turn: 1,
        wind,
        shotHistory: [],
        lastShot: null,
        predictedTrajectory: [],
        winner: null,
        physicsConfig: {
          ...DEFAULT_PHYSICS_CONFIG,
          windSpeed: wind,
        },
      });
    },
    
    resetGame: () => {
      set({
        phase: "menu",
        players: [{ ...INITIAL_PLAYER_1 }, { ...INITIAL_PLAYER_2 }],
        currentPlayerId: 1,
        turn: 1,
        wind: 0,
        shotHistory: [],
        lastShot: null,
        predictedTrajectory: [],
        winner: null,
        physicsConfig: { ...DEFAULT_PHYSICS_CONFIG },
      });
    },
    
    setPhase: (phase) => set({ phase }),
    
    setAngle: (playerId, angle) => {
      set((state) => ({
        players: state.players.map((p) =>
          p.id === playerId ? { ...p, angle: Math.max(0, Math.min(180, angle)) } : p
        ),
      }));
    },
    
    setPower: (playerId, power) => {
      set((state) => ({
        players: state.players.map((p) =>
          p.id === playerId ? { ...p, power: Math.max(5, Math.min(100, power)) } : p
        ),
      }));
    },
    
    adjustAngle: (delta) => {
      const { currentPlayerId, players } = get();
      const player = players.find((p) => p.id === currentPlayerId);
      if (player) {
        get().setAngle(currentPlayerId, player.angle + delta);
      }
    },
    
    adjustPower: (delta) => {
      const { currentPlayerId, players } = get();
      const player = players.find((p) => p.id === currentPlayerId);
      if (player) {
        get().setPower(currentPlayerId, player.power + delta);
      }
    },
    
    selectPowerUp: (playerId, powerUp) => {
      set((state) => ({
        players: state.players.map((p) =>
          p.id === playerId ? { ...p, selectedPowerUp: powerUp } : p
        ),
      }));
    },
    
    recordShot: (record) => {
      set((state) => ({
        shotHistory: [
          ...state.shotHistory,
          {
            ...record,
            id: `shot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
          },
        ],
      }));
    },
    
    setLastShot: (result) => set({ lastShot: result }),
    
    setPredictedTrajectory: (trajectory) => set({ predictedTrajectory: trajectory }),
    
    endTurn: () => {
      const { checkGameEnd } = get();
      checkGameEnd();
    },
    
    nextTurn: () => {
      const { currentPlayerId, turn, winner } = get();
      if (winner !== null) return;
      
      const newWind = generateWind(-8, 8);
      const nextPlayerId = currentPlayerId === 1 ? 2 : 1;
      const newTurn = nextPlayerId === 1 ? turn + 1 : turn;
      
      set((state) => ({
        currentPlayerId: nextPlayerId,
        turn: newTurn,
        wind: newWind,
        phase: "aiming",
        lastShot: null,
        predictedTrajectory: [],
        physicsConfig: {
          ...state.physicsConfig,
          windSpeed: newWind,
        },
      }));
    },
    
    applyDamage: (playerId, damage) => {
      set((state) => ({
        players: state.players.map((p) =>
          p.id === playerId
            ? { ...p, health: Math.max(0, p.health - damage) }
            : p
        ),
      }));
    },
    
    checkGameEnd: () => {
      const { players } = get();
      const deadPlayer = players.find((p) => p.health <= 0);
      
      if (deadPlayer) {
        const winner = players.find((p) => p.health > 0);
        set({
          phase: "game_over",
          winner: winner?.id || null,
        });
      }
    },
    
    setWind: (wind) => {
      set((state) => ({
        wind,
        physicsConfig: {
          ...state.physicsConfig,
          windSpeed: wind,
        },
      }));
    },
    
    updatePhysicsConfig: (config) => {
      set((state) => ({
        physicsConfig: { ...state.physicsConfig, ...config },
      }));
    },
    
    toggleTrajectoryPreview: () => {
      set((state) => ({ showTrajectoryPreview: !state.showTrajectoryPreview }));
    },
    
    getCurrentPlayer: () => {
      const { players, currentPlayerId } = get();
      return players.find((p) => p.id === currentPlayerId) || players[0];
    },
    
    getOpponent: () => {
      const { players, currentPlayerId } = get();
      return players.find((p) => p.id !== currentPlayerId) || players[1];
    },
    
    getPlayerCollisionBox: (playerId) => {
      const { players } = get();
      const player = players.find((p) => p.id === playerId) || players[0];
      return {
        x: player.position.x - 0.5,
        y: player.position.y - 0.5,
        width: 1,
        height: 2,
      };
    },
  }))
);
