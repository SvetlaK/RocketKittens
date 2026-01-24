// Sensor Fusion module for Fog of Yarn
// Implements Kalman Filter and Particle Filter for state estimation

import { Vector2D } from "../physics/ballistics";

export interface SensorMeasurement {
  position: Vector2D;
  timestamp: number;
  noise: number;  // Measurement noise standard deviation
}

export interface StateEstimate {
  position: Vector2D;
  velocity: Vector2D;
  uncertainty: {
    positionX: number;
    positionY: number;
    velocityX: number;
    velocityY: number;
  };
  confidence: number;
}

export interface KalmanState {
  x: number[];      // State vector [x, y, vx, vy]
  P: number[][];    // Covariance matrix
}

export interface KalmanConfig {
  processNoise: number;      // Q - process noise
  measurementNoise: number;  // R - measurement noise
  initialUncertainty: number;
}

export const DEFAULT_KALMAN_CONFIG: KalmanConfig = {
  processNoise: 0.1,
  measurementNoise: 1.0,
  initialUncertainty: 10,
};

// 4x4 Identity matrix
function eye4(): number[][] {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

// Matrix multiplication
function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = B[0].length;
  const k = B.length;
  const C: number[][] = Array(m).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      for (let l = 0; l < k; l++) {
        C[i][j] += A[i][l] * B[l][j];
      }
    }
  }
  return C;
}

// Matrix-vector multiplication
function matVec(A: number[][], v: number[]): number[] {
  return A.map(row => row.reduce((sum, a, i) => sum + a * v[i], 0));
}

// Matrix addition
function matAdd(A: number[][], B: number[][]): number[][] {
  return A.map((row, i) => row.map((val, j) => val + B[i][j]));
}

// Matrix subtraction
function matSub(A: number[][], B: number[][]): number[][] {
  return A.map((row, i) => row.map((val, j) => val - B[i][j]));
}

// Matrix transpose
function transpose(A: number[][]): number[][] {
  return A[0].map((_, j) => A.map(row => row[j]));
}

// Scalar multiply matrix
function scalarMul(s: number, A: number[][]): number[][] {
  return A.map(row => row.map(val => val * s));
}

// 2x2 matrix inverse (for measurement update)
function inv2x2(M: number[][]): number[][] {
  const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
  if (Math.abs(det) < 1e-10) {
    return [[1, 0], [0, 1]];
  }
  return [
    [M[1][1] / det, -M[0][1] / det],
    [-M[1][0] / det, M[0][0] / det],
  ];
}

// Kalman Filter for tracking target position
export class KalmanFilter {
  private state: KalmanState;
  private config: KalmanConfig;
  private lastUpdateTime: number;
  private F: number[][];  // State transition matrix
  private H: number[][];  // Measurement matrix
  private Q: number[][];  // Process noise
  private R: number[][];  // Measurement noise

  constructor(
    initialPosition: Vector2D,
    config: KalmanConfig = DEFAULT_KALMAN_CONFIG
  ) {
    this.config = config;
    this.lastUpdateTime = 0;
    
    // Initial state: [x, y, vx, vy]
    this.state = {
      x: [initialPosition.x, initialPosition.y, 0, 0],
      P: scalarMul(config.initialUncertainty, eye4()),
    };
    
    // State transition (constant velocity model)
    this.F = eye4();
    
    // Measurement matrix (we measure position only)
    this.H = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
    ];
    
    // Process noise
    this.Q = scalarMul(config.processNoise, eye4());
    
    // Measurement noise
    this.R = [
      [config.measurementNoise, 0],
      [0, config.measurementNoise],
    ];
  }

  // Predict step
  predict(dt: number): void {
    // Update state transition matrix with dt
    this.F = [
      [1, 0, dt, 0],
      [0, 1, 0, dt],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    
    // Predict state
    this.state.x = matVec(this.F, this.state.x);
    
    // Predict covariance
    const FP = matMul(this.F, this.state.P);
    const FPFt = matMul(FP, transpose(this.F));
    this.state.P = matAdd(FPFt, this.Q);
  }

  // Update step with measurement
  update(measurement: SensorMeasurement): void {
    const dt = measurement.timestamp - this.lastUpdateTime;
    if (dt > 0) {
      this.predict(dt);
    }
    this.lastUpdateTime = measurement.timestamp;
    
    // Measurement residual
    const z = [measurement.position.x, measurement.position.y];
    const Hx = matVec(this.H, this.state.x);
    const y = [z[0] - Hx[0], z[1] - Hx[1]];
    
    // Residual covariance
    const HP = matMul(this.H, this.state.P);
    const HPHt = matMul(HP, transpose(this.H));
    const S = matAdd(HPHt, scalarMul(measurement.noise * measurement.noise, this.R));
    
    // Kalman gain
    const PHt = matMul(this.state.P, transpose(this.H));
    const Sinv = inv2x2(S);
    const K = matMul(PHt, Sinv);
    
    // Update state
    const Ky = matVec(K, y);
    this.state.x = this.state.x.map((xi, i) => xi + Ky[i]);
    
    // Update covariance
    const KH = matMul(K, this.H);
    const IKH = matSub(eye4(), KH);
    this.state.P = matMul(IKH, this.state.P);
  }

  // Get current estimate
  getEstimate(): StateEstimate {
    const trace = this.state.P[0][0] + this.state.P[1][1] + 
                  this.state.P[2][2] + this.state.P[3][3];
    
    return {
      position: { x: this.state.x[0], y: this.state.x[1] },
      velocity: { x: this.state.x[2], y: this.state.x[3] },
      uncertainty: {
        positionX: Math.sqrt(this.state.P[0][0]),
        positionY: Math.sqrt(this.state.P[1][1]),
        velocityX: Math.sqrt(this.state.P[2][2]),
        velocityY: Math.sqrt(this.state.P[3][3]),
      },
      confidence: Math.max(0, Math.min(1, 1 - trace / (this.config.initialUncertainty * 4))),
    };
  }

  // Reset filter
  reset(position: Vector2D): void {
    this.state = {
      x: [position.x, position.y, 0, 0],
      P: scalarMul(this.config.initialUncertainty, eye4()),
    };
    this.lastUpdateTime = 0;
  }
}

// Particle for particle filter
interface Particle {
  position: Vector2D;
  velocity: Vector2D;
  weight: number;
}

export interface ParticleFilterConfig {
  numParticles: number;
  processNoise: number;
  measurementNoise: number;
  resampleThreshold: number;
}

export const DEFAULT_PARTICLE_CONFIG: ParticleFilterConfig = {
  numParticles: 100,
  processNoise: 0.5,
  measurementNoise: 2.0,
  resampleThreshold: 0.5,
};

// Particle Filter for non-linear tracking
export class ParticleFilter {
  private particles: Particle[];
  private config: ParticleFilterConfig;
  private lastUpdateTime: number;

  constructor(
    initialPosition: Vector2D,
    config: ParticleFilterConfig = DEFAULT_PARTICLE_CONFIG
  ) {
    this.config = config;
    this.lastUpdateTime = 0;
    
    // Initialize particles around initial position
    this.particles = Array(config.numParticles).fill(null).map(() => ({
      position: {
        x: initialPosition.x + (Math.random() - 0.5) * 4,
        y: initialPosition.y + (Math.random() - 0.5) * 4,
      },
      velocity: {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
      },
      weight: 1 / config.numParticles,
    }));
  }

  // Predict step - propagate particles
  predict(dt: number): void {
    for (const particle of this.particles) {
      // Add process noise
      const noise = this.config.processNoise;
      
      particle.velocity.x += (Math.random() - 0.5) * noise;
      particle.velocity.y += (Math.random() - 0.5) * noise;
      
      particle.position.x += particle.velocity.x * dt + (Math.random() - 0.5) * noise;
      particle.position.y += particle.velocity.y * dt + (Math.random() - 0.5) * noise;
    }
  }

  // Update weights based on measurement
  update(measurement: SensorMeasurement): void {
    const dt = measurement.timestamp - this.lastUpdateTime;
    if (dt > 0) {
      this.predict(dt);
    }
    this.lastUpdateTime = measurement.timestamp;
    
    const measNoise = measurement.noise || this.config.measurementNoise;
    
    // Update weights
    let totalWeight = 0;
    for (const particle of this.particles) {
      const dx = particle.position.x - measurement.position.x;
      const dy = particle.position.y - measurement.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Gaussian likelihood
      particle.weight = Math.exp(-dist * dist / (2 * measNoise * measNoise));
      totalWeight += particle.weight;
    }
    
    // Normalize weights
    if (totalWeight > 0) {
      for (const particle of this.particles) {
        particle.weight /= totalWeight;
      }
    }
    
    // Resample if needed
    this.resampleIfNeeded();
  }

  // Calculate effective sample size and resample if needed
  private resampleIfNeeded(): void {
    const sumSquaredWeights = this.particles.reduce((sum, p) => sum + p.weight * p.weight, 0);
    const effectiveSampleSize = 1 / sumSquaredWeights;
    
    if (effectiveSampleSize < this.config.numParticles * this.config.resampleThreshold) {
      this.resample();
    }
  }

  // Systematic resampling
  private resample(): void {
    const newParticles: Particle[] = [];
    const cumWeights: number[] = [];
    let cumSum = 0;
    
    for (const particle of this.particles) {
      cumSum += particle.weight;
      cumWeights.push(cumSum);
    }
    
    const step = 1 / this.config.numParticles;
    let u = Math.random() * step;
    let j = 0;
    
    for (let i = 0; i < this.config.numParticles; i++) {
      while (j < cumWeights.length - 1 && cumWeights[j] < u) {
        j++;
      }
      
      newParticles.push({
        position: { ...this.particles[j].position },
        velocity: { ...this.particles[j].velocity },
        weight: 1 / this.config.numParticles,
      });
      
      u += step;
    }
    
    this.particles = newParticles;
  }

  // Get weighted mean estimate
  getEstimate(): StateEstimate {
    let meanX = 0, meanY = 0, meanVx = 0, meanVy = 0;
    
    for (const particle of this.particles) {
      meanX += particle.position.x * particle.weight;
      meanY += particle.position.y * particle.weight;
      meanVx += particle.velocity.x * particle.weight;
      meanVy += particle.velocity.y * particle.weight;
    }
    
    // Calculate variance
    let varX = 0, varY = 0, varVx = 0, varVy = 0;
    for (const particle of this.particles) {
      varX += particle.weight * (particle.position.x - meanX) ** 2;
      varY += particle.weight * (particle.position.y - meanY) ** 2;
      varVx += particle.weight * (particle.velocity.x - meanVx) ** 2;
      varVy += particle.weight * (particle.velocity.y - meanVy) ** 2;
    }
    
    const totalVar = varX + varY + varVx + varVy;
    
    return {
      position: { x: meanX, y: meanY },
      velocity: { x: meanVx, y: meanVy },
      uncertainty: {
        positionX: Math.sqrt(varX),
        positionY: Math.sqrt(varY),
        velocityX: Math.sqrt(varVx),
        velocityY: Math.sqrt(varVy),
      },
      confidence: Math.max(0, Math.min(1, 1 - totalVar / 20)),
    };
  }

  // Get all particle positions for visualization
  getParticles(): Vector2D[] {
    return this.particles.map(p => ({ ...p.position }));
  }

  // Reset filter
  reset(position: Vector2D): void {
    this.particles = Array(this.config.numParticles).fill(null).map(() => ({
      position: {
        x: position.x + (Math.random() - 0.5) * 4,
        y: position.y + (Math.random() - 0.5) * 4,
      },
      velocity: {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
      },
      weight: 1 / this.config.numParticles,
    }));
    this.lastUpdateTime = 0;
  }
}

// Generate noisy measurement from true position
export function generateNoisyMeasurement(
  truePosition: Vector2D,
  noiseStd: number,
  timestamp: number,
  occluded: boolean = false
): SensorMeasurement | null {
  if (occluded) {
    return null;
  }
  
  return {
    position: {
      x: truePosition.x + (Math.random() - 0.5) * 2 * noiseStd,
      y: truePosition.y + (Math.random() - 0.5) * 2 * noiseStd,
    },
    timestamp,
    noise: noiseStd,
  };
}

// Check if target is occluded (random occlusion model)
export function isOccluded(occlusionProbability: number): boolean {
  return Math.random() < occlusionProbability;
}
