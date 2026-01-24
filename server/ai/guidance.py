import math
from dataclasses import dataclass
from typing import Dict, List, Any, Optional
from server.game.ballistics import PhysicsConfig, simulate_step, check_target_hit, calculate_damage

@dataclass
class GuidanceConfig:
    max_impulses: int = 3
    impulse_strength: float = 5.0
    correction_interval: float = 0.5
    proportional_gain: float = 0.8

def calculate_optimal_impulse(
    position: Dict[str, float],
    velocity: Dict[str, float],
    target_center: Dict[str, float],
    config: GuidanceConfig
) -> Dict[str, float]:
    to_target = {
        'x': target_center['x'] - position['x'],
        'y': target_center['y'] - position['y']
    }
    
    distance = math.sqrt(to_target['x']**2 + to_target['y']**2)
    if distance < 0.1:
        return {'x': 0, 'y': 0}
    
    direction = {
        'x': to_target['x'] / distance,
        'y': to_target['y'] / distance
    }
    
    desired_velocity = {
        'x': direction['x'] * math.sqrt(velocity['x']**2 + velocity['y']**2),
        'y': direction['y'] * math.sqrt(velocity['x']**2 + velocity['y']**2)
    }
    
    velocity_error = {
        'x': desired_velocity['x'] - velocity['x'],
        'y': desired_velocity['y'] - velocity['y']
    }
    
    impulse = {
        'x': velocity_error['x'] * config.proportional_gain,
        'y': velocity_error['y'] * config.proportional_gain
    }
    
    magnitude = math.sqrt(impulse['x']**2 + impulse['y']**2)
    if magnitude > config.impulse_strength:
        scale = config.impulse_strength / magnitude
        impulse['x'] *= scale
        impulse['y'] *= scale
    
    return impulse

def simulate_guided_trajectory(
    origin: Dict[str, float],
    initial_velocity: Dict[str, float],
    target_box: Dict[str, float],
    physics: PhysicsConfig,
    config: GuidanceConfig,
    terrain_height: float
) -> Dict[str, Any]:
    position = origin.copy()
    velocity = initial_velocity.copy()
    
    target_center = {
        'x': (target_box['min_x'] + target_box['max_x']) / 2,
        'y': (target_box['min_y'] + target_box['max_y']) / 2
    }
    
    trajectory = [{'position': position.copy(), 'velocity': velocity.copy(), 'time': 0}]
    impulses_applied = []
    impulses_remaining = config.max_impulses
    time = 0
    last_correction_time = 0
    max_steps = 1000
    hit_target = False
    
    for _ in range(max_steps):
        position, velocity = simulate_step(position, velocity, physics)
        time += physics.time_step
        
        if (time - last_correction_time >= config.correction_interval and 
            impulses_remaining > 0):
            
            impulse = calculate_optimal_impulse(position, velocity, target_center, config)
            
            if abs(impulse['x']) > 0.1 or abs(impulse['y']) > 0.1:
                velocity['x'] += impulse['x']
                velocity['y'] += impulse['y']
                impulses_remaining -= 1
                last_correction_time = time
                impulses_applied.append({
                    'time': time,
                    'position': position.copy(),
                    'impulse': impulse.copy()
                })
        
        trajectory.append({
            'position': position.copy(),
            'velocity': velocity.copy(),
            'time': time
        })
        
        if check_target_hit(position, target_box):
            hit_target = True
            break
        
        if position['y'] <= terrain_height:
            break
        
        if position['x'] < -50 or position['x'] > 50:
            break
    
    damage = calculate_damage(velocity) if hit_target else 0
    
    return {
        'trajectory': trajectory,
        'hit_target': hit_target,
        'impulses_applied': impulses_applied,
        'impulses_remaining': impulses_remaining,
        'damage': damage,
        'flight_time': time
    }
