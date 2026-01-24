import random
import math
from typing import Dict, List, Any, Optional
from server.game.ballistics import PhysicsConfig, simulate_trajectory

def monte_carlo_simulation(
    origin: Dict[str, float],
    angle: float,
    power: float,
    max_velocity: float,
    physics: PhysicsConfig,
    terrain_height: float,
    target_box: Dict[str, float],
    num_simulations: int = 100,
    wind_noise_std: float = 2.0,
    angle_noise_std: float = 1.0,
    power_noise_std: float = 2.0
) -> Dict[str, Any]:
    hits = 0
    trajectories = []
    distances = []
    flight_times = []
    max_heights = []
    
    for i in range(num_simulations):
        noisy_angle = angle + random.gauss(0, angle_noise_std)
        noisy_power = max(10, min(100, power + random.gauss(0, power_noise_std)))
        
        noisy_physics = PhysicsConfig(
            gravity=physics.gravity,
            drag_coefficient=physics.drag_coefficient,
            wind_speed=physics.wind_speed + random.gauss(0, wind_noise_std),
            wind_direction=physics.wind_direction,
            time_step=physics.time_step
        )
        
        result = simulate_trajectory(
            origin=origin,
            angle=noisy_angle,
            power=noisy_power,
            max_velocity=max_velocity,
            physics=noisy_physics,
            terrain_height=terrain_height,
            target_box=target_box
        )
        
        if result['hit_target']:
            hits += 1
        
        final_pos = result['final_position']
        distance = math.sqrt((final_pos['x'] - origin['x'])**2 + (final_pos['y'] - origin['y'])**2)
        distances.append(distance)
        flight_times.append(result['flight_time'])
        
        max_height = max(p['position']['y'] for p in result['trajectory'])
        max_heights.append(max_height)
        
        if i < 50:
            simplified_trajectory = [
                result['trajectory'][j]['position'] 
                for j in range(0, len(result['trajectory']), max(1, len(result['trajectory']) // 20))
            ]
            trajectories.append({
                'points': simplified_trajectory,
                'hit': result['hit_target']
            })
    
    hit_probability = hits / num_simulations
    
    return {
        'hit_probability': hit_probability,
        'num_simulations': num_simulations,
        'trajectories': trajectories,
        'statistics': {
            'avg_distance': sum(distances) / len(distances),
            'avg_flight_time': sum(flight_times) / len(flight_times),
            'avg_max_height': sum(max_heights) / len(max_heights),
            'min_distance': min(distances),
            'max_distance': max(distances)
        }
    }
