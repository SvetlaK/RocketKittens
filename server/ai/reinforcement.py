import math
import random
from typing import Dict, List, Any, Optional, Tuple
from server.game.ballistics import PhysicsConfig, simulate_trajectory

class QLearningAgent:
    def __init__(
        self,
        angle_bins: int = 18,
        power_bins: int = 10,
        learning_rate: float = 0.1,
        discount_factor: float = 0.95,
        epsilon: float = 0.2
    ):
        self.angle_bins = angle_bins
        self.power_bins = power_bins
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.epsilon = epsilon
        self.q_table: Dict[str, float] = {}
        self.experience_buffer: List[Dict] = []
    
    def _discretize_state(self, origin: Dict[str, float], target_pos: Dict[str, float], wind: Dict[str, float]) -> str:
        dx = round((target_pos['x'] - origin['x']) / 5) * 5
        dy = round((target_pos['y'] - origin['y']) / 2) * 2
        wind_bucket = round(wind['speed'] / 3) * 3
        return f"{dx}_{dy}_{wind_bucket}"
    
    def _action_to_params(self, action: int) -> Tuple[float, float]:
        angle_idx = action // self.power_bins
        power_idx = action % self.power_bins
        
        angle = 10 + (angle_idx * 160 / (self.angle_bins - 1))
        power = 20 + (power_idx * 80 / (self.power_bins - 1))
        
        return angle, power
    
    def _get_q_value(self, state: str, action: int) -> float:
        key = f"{state}_{action}"
        return self.q_table.get(key, 0.0)
    
    def _set_q_value(self, state: str, action: int, value: float):
        key = f"{state}_{action}"
        self.q_table[key] = value
    
    def get_action(
        self,
        origin: Dict[str, float],
        target_pos: Dict[str, float],
        wind: Dict[str, float]
    ) -> Dict[str, Any]:
        state = self._discretize_state(origin, target_pos, wind)
        
        if random.random() < self.epsilon:
            action = random.randint(0, self.angle_bins * self.power_bins - 1)
            exploration = True
        else:
            best_action = 0
            best_value = float('-inf')
            for a in range(self.angle_bins * self.power_bins):
                value = self._get_q_value(state, a)
                if value > best_value:
                    best_value = value
                    best_action = a
            action = best_action
            exploration = False
        
        angle, power = self._action_to_params(action)
        
        return {
            'angle': angle,
            'power': power,
            'action': action,
            'state': state,
            'exploration': exploration,
            'q_value': self._get_q_value(state, action)
        }
    
    def update(self, state: str, action: int, reward: float, next_state: str, done: bool):
        current_q = self._get_q_value(state, action)
        
        if done:
            target_q = reward
        else:
            max_next_q = max(self._get_q_value(next_state, a) 
                           for a in range(self.angle_bins * self.power_bins))
            target_q = reward + self.discount_factor * max_next_q
        
        new_q = current_q + self.learning_rate * (target_q - current_q)
        self._set_q_value(state, action, new_q)
    
    def get_stats(self) -> Dict[str, Any]:
        return {
            'q_table_size': len(self.q_table),
            'epsilon': self.epsilon,
            'experience_count': len(self.experience_buffer)
        }


class SupervisedAgent:
    def __init__(self, angle_resolution: int = 5, power_resolution: int = 5):
        self.angle_resolution = angle_resolution
        self.power_resolution = power_resolution
    
    def get_optimal_shot(
        self,
        origin: Dict[str, float],
        target_box: Dict[str, float],
        max_velocity: float,
        physics: PhysicsConfig,
        terrain_height: float
    ) -> Dict[str, Any]:
        best_angle = 45
        best_power = 50
        best_score = float('-inf')
        
        target_center = {
            'x': (target_box['min_x'] + target_box['max_x']) / 2,
            'y': (target_box['min_y'] + target_box['max_y']) / 2
        }
        
        for angle in range(10, 171, self.angle_resolution):
            for power in range(20, 101, self.power_resolution):
                result = simulate_trajectory(
                    origin=origin,
                    angle=angle,
                    power=power,
                    max_velocity=max_velocity,
                    physics=physics,
                    terrain_height=terrain_height,
                    target_box=target_box
                )
                
                if result['hit_target']:
                    score = 1000 + result['damage']
                else:
                    final_pos = result['final_position']
                    distance_to_target = math.sqrt(
                        (final_pos['x'] - target_center['x'])**2 +
                        (final_pos['y'] - target_center['y'])**2
                    )
                    score = -distance_to_target
                
                if score > best_score:
                    best_score = score
                    best_angle = angle
                    best_power = power
        
        return {
            'angle': best_angle,
            'power': best_power,
            'score': best_score,
            'is_hit': best_score >= 1000
        }
