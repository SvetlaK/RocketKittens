# RocketKittens

## Overview
RocketKittens is a turn-based artillery game where two kittens take turns shooting yarn balls at each other. The game features realistic ballistic physics with wind effects, trajectory prediction, and four aerospace AI subsystems that demonstrate real-world concepts like Monte Carlo simulation, Model Predictive Control, Reinforcement Learning, and Sensor Fusion.

## Current State
Full game with AI features complete:
- Two-player turn-based artillery combat
- Physics-based yarn projectile system with gravity, wind, and drag
- Trajectory prediction overlay
- Health system and win/loss conditions
- Visual kitten characters with aim indicators
- **Trajectory Lab**: Monte Carlo simulation with hit probability analysis
- **Smart Yarn**: MPC-guided projectile with mid-flight corrections
- **Autopilot Kitten**: RL and supervised learning AI opponents
- **Fog of Yarn**: Kalman/Particle filter sensor fusion

## Project Architecture

### Frontend Structure (client/src/)
```
lib/
  physics/
    ballistics.ts     # Core physics engine with trajectory calculations
    guidance.ts       # MPC guidance system for Smart Yarn
  ai/
    reinforcement.ts  # Q-Learning and Supervised agents for Autopilot
    sensorFusion.ts   # Kalman and Particle filters for Fog of Yarn
  stores/
    useRocketKittens.ts  # Game state management (Zustand)
    useAudio.tsx         # Audio state management
components/
  game/
    GameScene.tsx        # Main 3D game scene with Three.js
    GameUI.tsx           # React UI components (menus, controls, HUD)
    AIFeaturesPanel.tsx  # AI features toggle bar
    TrajectoryLab.tsx    # Monte Carlo simulation UI
    SmartYarn.tsx        # MPC guided projectile UI
    AutopilotKitten.tsx  # RL agent UI
    FogOfYarn.tsx        # Sensor fusion UI
    Terrain.tsx          # Ground, sky, and environment
    Kitten.tsx           # Player character rendering
    YarnBall.tsx         # Projectile and trajectory visualization
    SoundManager.tsx     # Audio initialization
```

### Physics Engine (ballistics.ts)
Pure functions for deterministic simulation:
- `simulateTrajectory()` - Full physics simulation with collision detection
- `predictTrajectory()` - Preview calculation without randomness
- `monteCarloSimulation()` - Run N simulations with noise for hit probability
- `calculateDamage()` - Impact velocity to damage conversion
- `generateWind()` - Random wind generation per turn

### Guidance System (guidance.ts)
Model Predictive Control for Smart Yarn:
- `mpcSolver()` - Optimal impulse calculation
- `simulateGuidedTrajectory()` - Full guided trajectory simulation
- `calculateOptimalImpulse()` - Proportional navigation
- `calculateReachableArea()` - Reachable envelope visualization

### AI Agents (reinforcement.ts)
- `QLearningAgent` - Tabular Q-learning with epsilon-greedy exploration
- `SupervisedAgent` - Optimal solver using grid search
- Experience replay buffer for batch learning
- Policy comparison utilities

### Sensor Fusion (sensorFusion.ts)
- `KalmanFilter` - Linear Gaussian state estimation
- `ParticleFilter` - Non-linear tracking with resampling
- Noisy measurement generation
- Occlusion modeling

## AI Feature Details

### 1. Trajectory Lab
Monte Carlo simulation for trajectory analysis:
- Run 100-1000 simulations with configurable noise
- Display hit probability percentage
- Show trajectory statistics (distance, flight time, max height)
- Configurable wind, angle, and power noise parameters

### 2. Smart Yarn (Guided Projectile)
MPC-based mid-flight course correction:
- Configurable max impulses (1-5)
- Adjustable impulse strength
- Correction interval settings
- Visual impulse effects during flight
- Reachable area envelope preview

### 3. Autopilot Kitten (AI Opponent)
Two learning modes:
- **Supervised**: Optimal trajectory solver using physics simulation
- **RL Agent**: Q-learning that improves through gameplay
- Apply suggested angle/power or auto-fire
- Exploration rate visualization

### 4. Fog of Yarn (Sensor Fusion)
Tracking under uncertainty:
- Kalman Filter: Fast, optimal for linear systems
- Particle Filter: Robust for non-linear dynamics
- Configurable measurement noise
- Occlusion probability simulation
- Uncertainty visualization with confidence metrics

## Recent Changes
- 2026-01-24: Added aerospace AI features
  - Trajectory Lab with Monte Carlo simulation
  - Smart Yarn with MPC guidance
  - Autopilot Kitten with RL/Supervised learning
  - Fog of Yarn with Kalman/Particle filters
  - AI features toggle panel in game UI

- 2026-01-24: Initial MVP implementation
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
- AI Feature buttons: Toggle aerospace simulations

## Aerospace Concepts Demonstrated
1. **Digital Twin**: Physics engine as deterministic model
2. **Monte Carlo**: Uncertainty propagation in trajectory prediction
3. **GNC (Guidance, Navigation, Control)**: MPC for projectile guidance
4. **Reinforcement Learning**: Policy learning for optimal aiming
5. **Sensor Fusion**: State estimation under noisy observations
