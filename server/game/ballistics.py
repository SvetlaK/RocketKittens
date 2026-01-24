import math
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Any

@dataclass
class PhysicsConfig:
    gravity: float = 9.81
    drag_coefficient: float = 0.01
    wind_speed: float = 0.0
    wind_direction: float = 0.0
    time_step: float = 0.016

def generate_wind() -> Dict[str, float]:
    speed = random.uniform(-10, 10)
    direction = 0 if speed >= 0 else 180
    return {'speed': abs(speed), 'direction': direction}

def calculate_initial_velocity(angle: float, power: float, max_velocity: float) -> Dict[str, float]:
    velocity_magnitude = (power / 100) * max_velocity
    angle_rad = math.radians(angle)
    return {
        'x': velocity_magnitude * math.cos(angle_rad),
        'y': velocity_magnitude * math.sin(angle_rad)
    }

def simulate_step(
    position: Dict[str, float],
    velocity: Dict[str, float],
    physics: PhysicsConfig
) -> tuple:
    dt = physics.time_step
    
    wind_rad = math.radians(physics.wind_direction)
    wind_force_x = physics.wind_speed * math.cos(wind_rad) * 0.1
    
    speed = math.sqrt(velocity['x']**2 + velocity['y']**2)
    drag_x = -physics.drag_coefficient * speed * velocity['x']
    drag_y = -physics.drag_coefficient * speed * velocity['y']
    
    ax = wind_force_x + drag_x
    ay = -physics.gravity + drag_y
    
    new_velocity = {
        'x': velocity['x'] + ax * dt,
        'y': velocity['y'] + ay * dt
    }
    
    new_position = {
        'x': position['x'] + new_velocity['x'] * dt,
        'y': position['y'] + new_velocity['y'] * dt
    }
    
    return new_position, new_velocity

def check_target_hit(position: Dict[str, float], target_box: Optional[Dict[str, float]]) -> bool:
    if not target_box:
        return False
    return (target_box['min_x'] <= position['x'] <= target_box['max_x'] and
            target_box['min_y'] <= position['y'] <= target_box['max_y'])

def calculate_damage(velocity: Dict[str, float]) -> float:
    impact_speed = math.sqrt(velocity['x']**2 + velocity['y']**2)
    base_damage = 10
    velocity_bonus = impact_speed * 1.5
    return min(50, base_damage + velocity_bonus)

def simulate_trajectory(
    origin: Dict[str, float],
    angle: float,
    power: float,
    max_velocity: float,
    physics: PhysicsConfig,
    terrain_height: float,
    target_box: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    position = origin.copy()
    velocity = calculate_initial_velocity(angle, power, max_velocity)
    
    trajectory = [{'position': position.copy(), 'velocity': velocity.copy(), 'time': 0}]
    hit_target = False
    hit_ground = False
    time = 0
    max_steps = 1000
    
    for _ in range(max_steps):
        position, velocity = simulate_step(position, velocity, physics)
        time += physics.time_step
        
        trajectory.append({
            'position': position.copy(),
            'velocity': velocity.copy(),
            'time': time
        })
        
        if check_target_hit(position, target_box):
            hit_target = True
            break
        
        if position['y'] <= terrain_height:
            hit_ground = True
            break
        
        if position['x'] < -50 or position['x'] > 50:
            break
    
    damage = calculate_damage(velocity) if hit_target else 0
    
    return {
        'trajectory': trajectory,
        'hit_target': hit_target,
        'hit_ground': hit_ground,
        'final_position': position,
        'damage': damage,
        'flight_time': time
    }

def predict_trajectory(
    origin: Dict[str, float],
    angle: float,
    power: float,
    max_velocity: float,
    physics: PhysicsConfig,
    terrain_height: float
) -> List[Dict[str, float]]:
    position = origin.copy()
    velocity = calculate_initial_velocity(angle, power, max_velocity)
    
    points = [position.copy()]
    max_steps = 500
    
    for _ in range(max_steps):
        position, velocity = simulate_step(position, velocity, physics)
        points.append(position.copy())
        
        if position['y'] <= terrain_height or position['x'] < -50 or position['x'] > 50:
            break
    
    return points
