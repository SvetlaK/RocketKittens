import math
import random
from typing import Dict, List, Any, Optional
import numpy as np

class KalmanFilter:
    def __init__(self, process_noise: float = 0.1, measurement_noise: float = 1.0):
        self.state = np.zeros(4)
        self.covariance = np.eye(4) * 100
        self.process_noise = process_noise
        self.measurement_noise = measurement_noise
        
        self.A = np.array([
            [1, 0, 0.1, 0],
            [0, 1, 0, 0.1],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ])
        
        self.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ])
        
        self.Q = np.eye(4) * process_noise
        self.R = np.eye(2) * measurement_noise
    
    def predict(self):
        self.state = self.A @ self.state
        self.covariance = self.A @ self.covariance @ self.A.T + self.Q
    
    def update(self, measurement: Dict[str, float]):
        z = np.array([measurement['x'], measurement['y']])
        
        y = z - self.H @ self.state
        S = self.H @ self.covariance @ self.H.T + self.R
        K = self.covariance @ self.H.T @ np.linalg.inv(S)
        
        self.state = self.state + K @ y
        self.covariance = (np.eye(4) - K @ self.H) @ self.covariance
    
    def get_estimate(self) -> Dict[str, Any]:
        uncertainty = math.sqrt(self.covariance[0, 0] + self.covariance[1, 1])
        return {
            'position': {'x': float(self.state[0]), 'y': float(self.state[1])},
            'velocity': {'x': float(self.state[2]), 'y': float(self.state[3])},
            'uncertainty': float(uncertainty)
        }
    
    def initialize(self, position: Dict[str, float]):
        self.state = np.array([position['x'], position['y'], 0, 0])
        self.covariance = np.eye(4) * 100


class ParticleFilter:
    def __init__(self, num_particles: int = 100, process_noise: float = 0.5, measurement_noise: float = 1.0):
        self.num_particles = num_particles
        self.process_noise = process_noise
        self.measurement_noise = measurement_noise
        self.particles = None
        self.weights = None
    
    def initialize(self, position: Dict[str, float]):
        self.particles = np.zeros((self.num_particles, 4))
        self.particles[:, 0] = position['x'] + np.random.randn(self.num_particles) * 2
        self.particles[:, 1] = position['y'] + np.random.randn(self.num_particles) * 2
        self.particles[:, 2] = np.random.randn(self.num_particles) * 0.5
        self.particles[:, 3] = np.random.randn(self.num_particles) * 0.5
        self.weights = np.ones(self.num_particles) / self.num_particles
    
    def predict(self):
        if self.particles is None:
            return
        
        dt = 0.1
        self.particles[:, 0] += self.particles[:, 2] * dt + np.random.randn(self.num_particles) * self.process_noise
        self.particles[:, 1] += self.particles[:, 3] * dt + np.random.randn(self.num_particles) * self.process_noise
        self.particles[:, 2] += np.random.randn(self.num_particles) * self.process_noise * 0.1
        self.particles[:, 3] += np.random.randn(self.num_particles) * self.process_noise * 0.1
    
    def update(self, measurement: Dict[str, float]):
        if self.particles is None:
            return
        
        distances = np.sqrt(
            (self.particles[:, 0] - measurement['x'])**2 +
            (self.particles[:, 1] - measurement['y'])**2
        )
        
        self.weights = np.exp(-distances**2 / (2 * self.measurement_noise**2))
        self.weights += 1e-10
        self.weights /= self.weights.sum()
        
        self._resample()
    
    def _resample(self):
        if self.particles is None or self.weights is None:
            return
        indices = np.random.choice(
            self.num_particles,
            size=self.num_particles,
            replace=True,
            p=self.weights
        )
        self.particles = self.particles[indices]
        self.weights = np.ones(self.num_particles) / self.num_particles
    
    def get_estimate(self) -> Dict[str, Any]:
        if self.particles is None:
            return {
                'position': {'x': 0, 'y': 0},
                'velocity': {'x': 0, 'y': 0},
                'uncertainty': float('inf')
            }
        
        mean_pos = np.average(self.particles[:, :2], weights=self.weights, axis=0)
        mean_vel = np.average(self.particles[:, 2:], weights=self.weights, axis=0)
        
        variance = np.average(
            (self.particles[:, :2] - mean_pos)**2,
            weights=self.weights,
            axis=0
        )
        uncertainty = math.sqrt(variance.sum())
        
        return {
            'position': {'x': float(mean_pos[0]), 'y': float(mean_pos[1])},
            'velocity': {'x': float(mean_vel[0]), 'y': float(mean_vel[1])},
            'uncertainty': float(uncertainty)
        }


def generate_noisy_measurement(
    true_position: Dict[str, float],
    noise_std: float = 1.0,
    occlusion_probability: float = 0.1
) -> Optional[Dict[str, float]]:
    if random.random() < occlusion_probability:
        return None
    
    return {
        'x': true_position['x'] + random.gauss(0, noise_std),
        'y': true_position['y'] + random.gauss(0, noise_std)
    }
