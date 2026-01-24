# RocketKittens

## Overview
RocketKittens is a turn-based artillery game where two kittens take turns shooting yarn balls at each other. The game features realistic ballistic physics with wind effects, trajectory prediction, and four aerospace AI subsystems that demonstrate real-world concepts like Monte Carlo simulation, Model Predictive Control, Reinforcement Learning, and Sensor Fusion.

## Current State
**Rewritten in Python** with Flask backend and HTML5 Canvas frontend:
- Two-player turn-based artillery combat
- Physics-based yarn projectile system with gravity, wind, and drag
- Trajectory prediction overlay (updates in real-time)
- Health system and win/loss conditions
- Visual kitten characters with aim indicators
- **Trajectory Lab**: Monte Carlo simulation with hit probability analysis
- **Autopilot Kitten**: RL and supervised learning AI opponents
- WebSocket-based real-time game state synchronization

## Project Architecture

### Backend (Python/Flask)
```
app.py                      # Main Flask application with SocketIO
server/
  game/
    ballistics.py           # Core physics engine
  ai/
    monte_carlo.py          # Monte Carlo simulation
    guidance.py             # MPC guidance system
    reinforcement.py        # Q-Learning and Supervised agents
    sensor_fusion.py        # Kalman and Particle filters
```

### Frontend (HTML5/Canvas)
```
templates/
  index.html                # Main game page
static/
  css/
    style.css               # Game styling
  js/
    game.js                 # Canvas rendering and game logic
```

### Physics Engine (ballistics.py)
Pure functions for deterministic simulation:
- `simulate_trajectory()` - Full physics simulation with collision detection
- `predict_trajectory()` - Preview calculation without randomness
- `calculate_damage()` - Impact velocity to damage conversion
- `generate_wind()` - Random wind generation per turn
- `PhysicsConfig` - Configurable physics parameters

### AI Modules

#### Monte Carlo (monte_carlo.py)
- `monte_carlo_simulation()` - Run N simulations with noise for hit probability
- Configurable noise parameters for wind, angle, and power
- Returns hit probability and trajectory statistics

#### Guidance System (guidance.py)
Model Predictive Control for Smart Yarn:
- `GuidanceConfig` - Impulse budget and strength settings
- `calculate_optimal_impulse()` - Proportional navigation
- `simulate_guided_trajectory()` - Full guided trajectory with corrections

#### Reinforcement Learning (reinforcement.py)
- `QLearningAgent` - Tabular Q-learning with epsilon-greedy exploration
- `SupervisedAgent` - Optimal solver using grid search
- State discretization for compact Q-table

#### Sensor Fusion (sensor_fusion.py)
- `KalmanFilter` - Linear Gaussian state estimation
- `ParticleFilter` - Non-linear tracking with resampling
- `generate_noisy_measurement()` - Simulated sensor noise

## Recent Changes
- 2026-01-24: **Complete Python rewrite**
  - Flask backend with Flask-SocketIO for real-time updates
  - HTML5 Canvas frontend replacing React/Three.js
  - All physics and AI modules ported to Python
  - WebSocket-based game state synchronization

- 2026-01-24: Added aerospace AI features
  - Trajectory Lab with Monte Carlo simulation
  - Smart Yarn with MPC guidance
  - Autopilot Kitten with RL/Supervised learning
  - Fog of Yarn with Kalman/Particle filters

## Technologies
- Python 3.11
- Flask with Flask-SocketIO
- HTML5 Canvas for rendering
- NumPy for numerical computation
- Eventlet for async WebSocket handling

## Running the Game
```bash
python app.py
```
The game will be available at http://localhost:5000

## Controls
- W/S or Up/Down: Adjust angle
- A/D or Left/Right: Adjust power  
- Space: Fire yarn ball
- AI Feature buttons: Access Monte Carlo and Autopilot

## Aerospace Concepts Demonstrated
1. **Digital Twin**: Physics engine as deterministic model
2. **Monte Carlo**: Uncertainty propagation in trajectory prediction
3. **GNC (Guidance, Navigation, Control)**: MPC for projectile guidance
4. **Reinforcement Learning**: Policy learning for optimal aiming
5. **Sensor Fusion**: State estimation under noisy observations
