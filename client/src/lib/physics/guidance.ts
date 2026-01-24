// Guidance, Navigation & Control (GNC) module for Smart Yarn
// Implements Model Predictive Control for mid-flight course correction

import { 
  Vector2D, 
  PhysicsConfig, 
  physicsStep, 
  checkCollision,
  checkTerrainCollision,
  CollisionBox,
} from "./ballistics";

export interface GuidanceConfig {
  maxImpulses: number;           // Maximum number of course corrections
  impulseStrength: number;       // Maximum impulse magnitude (m/s)
  controlHorizon: number;        // MPC look-ahead steps
  predictionSteps: number;       // How far ahead to simulate
  correctionInterval: number;    // Minimum time between corrections (seconds)
}

export interface ImpulseCommand {
  time: number;
  direction: Vector2D;  // Normalized direction
  magnitude: number;    // Actual impulse strength applied
}

export interface GuidedTrajectoryResult {
  trajectory: { position: Vector2D; velocity: Vector2D; time: number }[];
  impulses: ImpulseCommand[];
  hitTarget: boolean;
  remainingImpulses: number;
  finalPosition: Vector2D;
}

export const DEFAULT_GUIDANCE_CONFIG: GuidanceConfig = {
  maxImpulses: 3,
  impulseStrength: 5,
  controlHorizon: 10,
  predictionSteps: 50,
  correctionInterval: 0.3,
};

// Normalize a 2D vector
function normalize(v: Vector2D): Vector2D {
  const mag = Math.sqrt(v.x ** 2 + v.y ** 2);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

// Calculate distance between two points
function distance(a: Vector2D, b: Vector2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Predict future trajectory without guidance
function predictUnguided(
  position: Vector2D,
  velocity: Vector2D,
  config: PhysicsConfig,
  steps: number,
  terrainHeight: number
): Vector2D[] {
  const points: Vector2D[] = [{ ...position }];
  let pos = { ...position };
  let vel = { ...velocity };
  
  for (let i = 0; i < steps; i++) {
    const result = physicsStep(pos, vel, config);
    pos = result.position;
    vel = result.velocity;
    points.push({ ...pos });
    
    if (checkTerrainCollision(pos, terrainHeight)) break;
  }
  
  return points;
}

// Calculate optimal impulse direction using proportional navigation
export function calculateOptimalImpulse(
  position: Vector2D,
  velocity: Vector2D,
  targetCenter: Vector2D,
  config: GuidanceConfig
): Vector2D {
  // Vector to target
  const toTarget: Vector2D = {
    x: targetCenter.x - position.x,
    y: targetCenter.y - position.y,
  };
  
  // Proportional navigation: steer towards where the target will be
  // Simplified: just point towards target with velocity compensation
  const timeToTarget = distance(position, targetCenter) / Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
  
  // Predicted intercept point (stationary target)
  const interceptPoint = targetCenter;
  
  // Desired velocity direction
  const desiredDir = normalize({
    x: interceptPoint.x - position.x,
    y: interceptPoint.y - position.y,
  });
  
  // Current velocity direction
  const currentDir = normalize(velocity);
  
  // Correction direction (difference between desired and current)
  const correction: Vector2D = {
    x: desiredDir.x - currentDir.x,
    y: desiredDir.y - currentDir.y,
  };
  
  const correctionNorm = normalize(correction);
  
  return {
    x: correctionNorm.x * config.impulseStrength,
    y: correctionNorm.y * config.impulseStrength,
  };
}

// Model Predictive Control solver
export function mpcSolver(
  currentPosition: Vector2D,
  currentVelocity: Vector2D,
  targetBox: CollisionBox,
  physicsConfig: PhysicsConfig,
  guidanceConfig: GuidanceConfig,
  terrainHeight: number
): ImpulseCommand | null {
  const targetCenter: Vector2D = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height / 2,
  };
  
  // Predict unguided trajectory
  const unguidedPath = predictUnguided(
    currentPosition,
    currentVelocity,
    physicsConfig,
    guidanceConfig.predictionSteps,
    terrainHeight
  );
  
  // Check if already on collision course
  for (const point of unguidedPath) {
    if (checkCollision(point, targetBox)) {
      return null; // No correction needed
    }
  }
  
  // Find closest approach point
  let minDist = Infinity;
  let closestPoint = unguidedPath[unguidedPath.length - 1];
  
  for (const point of unguidedPath) {
    const dist = distance(point, targetCenter);
    if (dist < minDist) {
      minDist = dist;
      closestPoint = point;
    }
  }
  
  // If we're going to miss by too much, apply correction
  if (minDist > targetBox.width * 2) {
    const impulse = calculateOptimalImpulse(
      currentPosition,
      currentVelocity,
      targetCenter,
      guidanceConfig
    );
    
    return {
      time: 0,
      direction: normalize(impulse),
      magnitude: Math.min(
        Math.sqrt(impulse.x ** 2 + impulse.y ** 2),
        guidanceConfig.impulseStrength
      ),
    };
  }
  
  return null;
}

// Simulate guided trajectory with MPC control
export function simulateGuidedTrajectory(
  origin: Vector2D,
  initialVelocity: Vector2D,
  targetBox: CollisionBox,
  physicsConfig: PhysicsConfig,
  guidanceConfig: GuidanceConfig,
  terrainHeight: number,
  maxTime: number = 30
): GuidedTrajectoryResult {
  const trajectory: { position: Vector2D; velocity: Vector2D; time: number }[] = [];
  const appliedImpulses: ImpulseCommand[] = [];
  
  let position = { ...origin };
  let velocity = { ...initialVelocity };
  let time = 0;
  let remainingImpulses = guidanceConfig.maxImpulses;
  let lastCorrectionTime = -guidanceConfig.correctionInterval;
  let hitTarget = false;
  
  trajectory.push({ position: { ...position }, velocity: { ...velocity }, time });
  
  while (time < maxTime && !hitTarget) {
    // Check if we should apply correction
    if (
      remainingImpulses > 0 &&
      time - lastCorrectionTime >= guidanceConfig.correctionInterval
    ) {
      const impulse = mpcSolver(
        position,
        velocity,
        targetBox,
        physicsConfig,
        guidanceConfig,
        terrainHeight
      );
      
      if (impulse) {
        velocity = {
          x: velocity.x + impulse.direction.x * impulse.magnitude,
          y: velocity.y + impulse.direction.y * impulse.magnitude,
        };
        
        appliedImpulses.push({
          ...impulse,
          time,
        });
        
        remainingImpulses--;
        lastCorrectionTime = time;
      }
    }
    
    // Physics step
    const result = physicsStep(position, velocity, physicsConfig);
    position = result.position;
    velocity = result.velocity;
    time += physicsConfig.timeStep;
    
    trajectory.push({ position: { ...position }, velocity: { ...velocity }, time });
    
    // Check collisions
    if (checkCollision(position, targetBox)) {
      hitTarget = true;
      break;
    }
    
    if (checkTerrainCollision(position, terrainHeight)) {
      break;
    }
    
    if (position.x < -50 || position.x > 100) {
      break;
    }
  }
  
  return {
    trajectory,
    impulses: appliedImpulses,
    hitTarget,
    remainingImpulses,
    finalPosition: position,
  };
}

// Visualize guidance cone (reachable area from current state)
export function calculateReachableArea(
  position: Vector2D,
  velocity: Vector2D,
  remainingImpulses: number,
  physicsConfig: PhysicsConfig,
  guidanceConfig: GuidanceConfig,
  terrainHeight: number,
  numSamples: number = 12
): Vector2D[][] {
  if (remainingImpulses === 0) return [];
  
  const trajectories: Vector2D[][] = [];
  
  for (let i = 0; i < numSamples; i++) {
    const angle = (i / numSamples) * Math.PI * 2;
    const impulse: Vector2D = {
      x: Math.cos(angle) * guidanceConfig.impulseStrength,
      y: Math.sin(angle) * guidanceConfig.impulseStrength,
    };
    
    const newVelocity: Vector2D = {
      x: velocity.x + impulse.x,
      y: velocity.y + impulse.y,
    };
    
    const path = predictUnguided(
      position,
      newVelocity,
      physicsConfig,
      guidanceConfig.predictionSteps,
      terrainHeight
    );
    
    trajectories.push(path);
  }
  
  return trajectories;
}
