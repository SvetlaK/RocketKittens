// Core ballistics physics engine for RocketKittens
// Designed as pure functions for deterministic simulation and Monte Carlo compatibility

export interface Vector2D {
  x: number;
  y: number;
}

export interface PhysicsConfig {
  gravity: number;        // m/s^2 (default: 9.81)
  airDensity: number;     // kg/m^3 (default: 1.225)
  dragCoefficient: number; // dimensionless (default: 0.47 for sphere)
  projectileMass: number;  // kg
  projectileRadius: number; // m
  windSpeed: number;       // m/s (positive = right, negative = left)
  windVariance: number;    // random variance applied to wind
  timeStep: number;        // simulation timestep in seconds
}

export interface TrajectoryPoint {
  position: Vector2D;
  velocity: Vector2D;
  time: number;
}

export interface ShotParameters {
  origin: Vector2D;
  angle: number;     // degrees (0 = right, 90 = up)
  power: number;     // 0-100 scale, maps to initial velocity
  maxVelocity: number; // maximum velocity in m/s
}

export interface ShotResult {
  trajectory: TrajectoryPoint[];
  finalPosition: Vector2D;
  flightTime: number;
  maxHeight: number;
  distance: number;
  hitTarget: boolean;
  impactVelocity: number;
}

export interface CollisionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Default physics configuration
export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  gravity: 9.81,
  airDensity: 1.225,
  dragCoefficient: 0.47,
  projectileMass: 0.1, // 100g yarn ball
  projectileRadius: 0.05, // 5cm radius
  windSpeed: 0,
  windVariance: 0,
  timeStep: 0.016, // ~60fps
};

// Convert degrees to radians
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Convert radians to degrees
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

// Calculate initial velocity from power (0-100) and max velocity
export function powerToVelocity(power: number, maxVelocity: number): number {
  return (power / 100) * maxVelocity;
}

// Calculate initial velocity vector from angle and power
export function calculateInitialVelocity(
  angle: number, 
  power: number, 
  maxVelocity: number
): Vector2D {
  const speed = powerToVelocity(power, maxVelocity);
  const angleRad = degToRad(angle);
  return {
    x: speed * Math.cos(angleRad),
    y: speed * Math.sin(angleRad),
  };
}

// Calculate drag force (simplified model)
export function calculateDragForce(
  velocity: Vector2D,
  config: PhysicsConfig
): Vector2D {
  const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
  if (speed === 0) return { x: 0, y: 0 };

  // F_drag = 0.5 * rho * v^2 * Cd * A
  const area = Math.PI * config.projectileRadius ** 2;
  const dragMagnitude = 0.5 * config.airDensity * speed ** 2 * 
                        config.dragCoefficient * area;
  
  // Drag opposes motion
  return {
    x: -dragMagnitude * (velocity.x / speed) / config.projectileMass,
    y: -dragMagnitude * (velocity.y / speed) / config.projectileMass,
  };
}

// Calculate wind force as acceleration
export function calculateWindForce(config: PhysicsConfig): Vector2D {
  const effectiveWind = config.windSpeed + 
    (Math.random() - 0.5) * 2 * config.windVariance;
  
  // Wind applies horizontal force proportional to cross-sectional area
  const area = Math.PI * config.projectileRadius ** 2;
  const windForce = 0.5 * config.airDensity * effectiveWind ** 2 * 
                    config.dragCoefficient * area * Math.sign(effectiveWind);
  
  return {
    x: windForce / config.projectileMass,
    y: 0,
  };
}

// Single physics step using Euler integration
export function physicsStep(
  position: Vector2D,
  velocity: Vector2D,
  config: PhysicsConfig
): { position: Vector2D; velocity: Vector2D } {
  // Calculate all forces
  const drag = calculateDragForce(velocity, config);
  const wind = calculateWindForce(config);
  
  // Total acceleration
  const acceleration: Vector2D = {
    x: drag.x + wind.x,
    y: -config.gravity + drag.y + wind.y,
  };
  
  // Update velocity
  const newVelocity: Vector2D = {
    x: velocity.x + acceleration.x * config.timeStep,
    y: velocity.y + acceleration.y * config.timeStep,
  };
  
  // Update position
  const newPosition: Vector2D = {
    x: position.x + newVelocity.x * config.timeStep,
    y: position.y + newVelocity.y * config.timeStep,
  };
  
  return { position: newPosition, velocity: newVelocity };
}

// Check AABB collision
export function checkCollision(
  point: Vector2D,
  box: CollisionBox
): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

// Check if point is below terrain (simplified flat terrain)
export function checkTerrainCollision(
  point: Vector2D,
  terrainHeight: number
): boolean {
  return point.y <= terrainHeight;
}

// Simulate full trajectory
export function simulateTrajectory(
  params: ShotParameters,
  config: PhysicsConfig,
  terrainHeight: number = 0,
  targetBox?: CollisionBox,
  maxTime: number = 30 // max simulation time in seconds
): ShotResult {
  const trajectory: TrajectoryPoint[] = [];
  let position = { ...params.origin };
  let velocity = calculateInitialVelocity(params.angle, params.power, params.maxVelocity);
  let time = 0;
  let maxHeight = params.origin.y;
  let hitTarget = false;
  
  // Record initial point
  trajectory.push({ position: { ...position }, velocity: { ...velocity }, time });
  
  // Simulate until ground collision or max time
  while (time < maxTime) {
    const result = physicsStep(position, velocity, config);
    position = result.position;
    velocity = result.velocity;
    time += config.timeStep;
    
    // Track max height
    if (position.y > maxHeight) {
      maxHeight = position.y;
    }
    
    // Record point
    trajectory.push({ 
      position: { ...position }, 
      velocity: { ...velocity }, 
      time 
    });
    
    // Check target collision
    if (targetBox && checkCollision(position, targetBox)) {
      hitTarget = true;
      break;
    }
    
    // Check terrain collision
    if (checkTerrainCollision(position, terrainHeight)) {
      // Clamp to terrain
      position.y = terrainHeight;
      break;
    }
    
    // Check out of bounds (too far left or right)
    if (position.x < -50 || position.x > 100) {
      break;
    }
  }
  
  const finalVelocity = trajectory[trajectory.length - 1].velocity;
  const impactVelocity = Math.sqrt(finalVelocity.x ** 2 + finalVelocity.y ** 2);
  
  return {
    trajectory,
    finalPosition: position,
    flightTime: time,
    maxHeight,
    distance: Math.abs(position.x - params.origin.x),
    hitTarget,
    impactVelocity,
  };
}

// Predict trajectory without simulation effects (for preview)
export function predictTrajectory(
  params: ShotParameters,
  config: PhysicsConfig,
  terrainHeight: number = 0,
  numPoints: number = 50
): Vector2D[] {
  const points: Vector2D[] = [];
  const tempConfig = { ...config, windVariance: 0 }; // No variance in prediction
  
  let position = { ...params.origin };
  let velocity = calculateInitialVelocity(params.angle, params.power, params.maxVelocity);
  
  points.push({ ...position });
  
  for (let i = 0; i < numPoints * 10; i++) {
    const result = physicsStep(position, velocity, tempConfig);
    position = result.position;
    velocity = result.velocity;
    
    // Sample every few steps for smoother preview
    if (i % 10 === 0) {
      points.push({ ...position });
    }
    
    // Stop at terrain
    if (position.y <= terrainHeight) {
      points.push({ x: position.x, y: terrainHeight });
      break;
    }
    
    // Stop if out of bounds
    if (position.x < -50 || position.x > 100) {
      break;
    }
  }
  
  return points;
}

// Calculate damage based on impact velocity
export function calculateDamage(
  impactVelocity: number,
  baseDamage: number = 25,
  velocityScale: number = 0.5
): number {
  // Damage scales with impact velocity
  const damage = baseDamage + impactVelocity * velocityScale;
  return Math.min(Math.round(damage), 50); // Cap at 50 damage
}

// Generate random wind for a new turn
export function generateWind(
  minSpeed: number = -10,
  maxSpeed: number = 10
): number {
  return minSpeed + Math.random() * (maxSpeed - minSpeed);
}

// Monte Carlo simulation - run multiple trajectories with noise
export function monteCarloSimulation(
  params: ShotParameters,
  baseConfig: PhysicsConfig,
  terrainHeight: number,
  targetBox: CollisionBox,
  numSimulations: number = 100,
  windNoiseStd: number = 2,
  angleNoiseStd: number = 1,
  powerNoiseStd: number = 2
): { hitRate: number; trajectories: ShotResult[]; heatmap: Map<string, number> } {
  const results: ShotResult[] = [];
  const heatmap = new Map<string, number>();
  let hits = 0;
  
  for (let i = 0; i < numSimulations; i++) {
    // Add noise to parameters
    const noisyParams = {
      ...params,
      angle: params.angle + (Math.random() - 0.5) * 2 * angleNoiseStd,
      power: Math.max(0, Math.min(100, 
        params.power + (Math.random() - 0.5) * 2 * powerNoiseStd)),
    };
    
    const noisyConfig = {
      ...baseConfig,
      windSpeed: baseConfig.windSpeed + (Math.random() - 0.5) * 2 * windNoiseStd,
    };
    
    const result = simulateTrajectory(noisyParams, noisyConfig, terrainHeight, targetBox);
    results.push(result);
    
    if (result.hitTarget) {
      hits++;
    }
    
    // Add to heatmap (grid resolution of 1 unit)
    const gridX = Math.floor(result.finalPosition.x);
    const gridY = Math.floor(result.finalPosition.y);
    const key = `${gridX},${gridY}`;
    heatmap.set(key, (heatmap.get(key) || 0) + 1);
  }
  
  return {
    hitRate: hits / numSimulations,
    trajectories: results,
    heatmap,
  };
}
