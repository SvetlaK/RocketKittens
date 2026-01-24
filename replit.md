# RocketKittens

## Overview
RocketKittens is a turn-based artillery game where two kittens take turns shooting yarn balls at each other. The game features realistic ballistic physics with wind effects, trajectory prediction, and a modular architecture designed to support advanced aerospace AI concepts.

## Current State
MVP complete with core gameplay mechanics:
- Two-player turn-based artillery combat
- Physics-based yarn projectile system with gravity, wind, and drag
- Trajectory prediction overlay
- Health system and win/loss conditions
- Visual kitten characters with aim indicators

## Project Architecture

### Frontend Structure (client/src/)
```
lib/
  physics/
    ballistics.ts     # Core physics engine with trajectory calculations
  stores/
    useRocketKittens.ts  # Game state management (Zustand)
    useAudio.tsx         # Audio state management
components/
  game/
    GameScene.tsx     # Main 3D game scene with Three.js
    GameUI.tsx        # React UI components (menus, controls, HUD)
    Terrain.tsx       # Ground, sky, and environment
    Kitten.tsx        # Player character rendering
    YarnBall.tsx      # Projectile and trajectory visualization
    SoundManager.tsx  # Audio initialization
```

### Physics Engine (ballistics.ts)
Pure functions for deterministic simulation:
- `simulateTrajectory()` - Full physics simulation with collision detection
- `predictTrajectory()` - Preview calculation without randomness
- `monteCarloSimulation()` - Run N simulations with noise for hit probability
- `calculateDamage()` - Impact velocity to damage conversion
- `generateWind()` - Random wind generation per turn

### Game State (useRocketKittens.ts)
Zustand store managing:
- Player positions, health, angle, power
- Turn management and phase transitions
- Shot history logging for AI training data
- Physics configuration exposure for AI modules

## Future AI Integration Points

### 1. Trajectory Lab
- Monte Carlo already implemented in ballistics.ts
- Add UI to run 100-1000 simulations
- Render hit probability heatmap on terrain

### 2. Smart Yarn (Guided Projectile)
- Mid-flight course correction with impulse limits
- Model Predictive Control (MPC) for optimal guidance
- Extend physicsStep() to accept mid-flight impulses

### 3. Autopilot Kitten (RL Agent)
- Observation space: player positions, wind, terrain
- Action space: angle (0-180), power (0-100)
- Reward: damage dealt, hits, wins
- Training data collected via shotHistory

### 4. Fog of Yarn (Sensor Fusion)
- Add noise to opponent position observation
- Implement Kalman filter for state estimation
- Particle filter for non-linear dynamics

## Recent Changes
- 2026-01-24: Initial MVP implementation with core gameplay
  - Physics engine with gravity, wind, drag
  - Turn-based gameplay loop
  - Visual kitten characters with aim indicators
  - Trajectory preview system
  - Health and damage system

## Technologies
- React 18 with TypeScript
- Three.js via @react-three/fiber and @react-three/drei
- Zustand for state management
- Tailwind CSS for UI styling
- Express.js backend (minimal, for serving)

## Controls
- W/S or Up/Down: Adjust angle
- A/D or Left/Right: Adjust power  
- Space: Fire yarn ball
- Mouse: Orbit camera view
