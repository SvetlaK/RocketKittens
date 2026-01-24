from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import json
from server.game.ballistics import (
    PhysicsConfig, 
    simulate_trajectory, 
    predict_trajectory,
    generate_wind,
    calculate_initial_velocity
)
from server.ai.monte_carlo import monte_carlo_simulation
from server.ai.guidance import simulate_guided_trajectory, GuidanceConfig
from server.ai.reinforcement import QLearningAgent, SupervisedAgent
from server.ai.sensor_fusion import KalmanFilter, ParticleFilter

app = Flask(__name__)
app.config['SECRET_KEY'] = 'rocket-kittens-secret'
socketio = SocketIO(app, cors_allowed_origins="*")

games = {}

DEFAULT_PHYSICS = PhysicsConfig(
    gravity=9.81,
    drag_coefficient=0.01,
    wind_speed=0.0,
    wind_direction=0.0,
    time_step=0.016
)

def create_player(player_id, x_position, color, facing_right):
    return {
        'id': player_id,
        'position': {'x': x_position, 'y': 2.0},
        'health': 100,
        'max_health': 100,
        'angle': 45 if facing_right else 135,
        'power': 50,
        'color': color,
        'facing_right': facing_right
    }

def create_game_state():
    wind = generate_wind()
    return {
        'players': [
            create_player('player1', -15, '#e74c3c', True),
            create_player('player2', 15, '#3498db', False)
        ],
        'current_player_id': 'player1',
        'phase': 'menu',
        'physics_config': DEFAULT_PHYSICS.__dict__,
        'terrain_height': 0.0,
        'max_velocity': 30.0,
        'wind': wind,
        'predicted_trajectory': [],
        'last_shot': None,
        'winner': None
    }

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    sid = request.sid  # type: ignore
    games[sid] = create_game_state()
    emit('game_state', games[sid])

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid  # type: ignore
    if sid in games:
        del games[sid]

@socketio.on('start_game')
def handle_start_game():
    sid = request.sid  # type: ignore
    games[sid] = create_game_state()
    games[sid]['phase'] = 'aiming'
    games[sid]['wind'] = generate_wind()
    emit('game_state', games[sid])

@socketio.on('adjust_angle')
def handle_adjust_angle(data):
    sid = request.sid  # type: ignore
    game = games.get(sid)
    if not game or game['phase'] != 'aiming':
        return
    
    delta = data.get('delta', 0)
    player = next(p for p in game['players'] if p['id'] == game['current_player_id'])
    player['angle'] = max(0, min(180, player['angle'] + delta))
    
    update_trajectory_preview(game)
    emit('game_state', game)

@socketio.on('adjust_power')
def handle_adjust_power(data):
    sid = request.sid  # type: ignore
    game = games.get(sid)
    if not game or game['phase'] != 'aiming':
        return
    
    delta = data.get('delta', 0)
    player = next(p for p in game['players'] if p['id'] == game['current_player_id'])
    player['power'] = max(10, min(100, player['power'] + delta))
    
    update_trajectory_preview(game)
    emit('game_state', game)

@socketio.on('fire')
def handle_fire():
    sid = request.sid  # type: ignore
    game = games.get(sid)
    if not game or game['phase'] != 'aiming':
        return
    
    game['phase'] = 'shooting'
    player = next(p for p in game['players'] if p['id'] == game['current_player_id'])
    opponent = next(p for p in game['players'] if p['id'] != game['current_player_id'])
    
    target_box = {
        'min_x': opponent['position']['x'] - 1.5,
        'max_x': opponent['position']['x'] + 1.5,
        'min_y': opponent['position']['y'] - 1.0,
        'max_y': opponent['position']['y'] + 3.0
    }
    
    physics = PhysicsConfig(**game['physics_config'])
    physics.wind_speed = game['wind']['speed']
    physics.wind_direction = game['wind']['direction']
    
    result = simulate_trajectory(
        origin=player['position'],
        angle=player['angle'],
        power=player['power'],
        max_velocity=game['max_velocity'],
        physics=physics,
        terrain_height=game['terrain_height'],
        target_box=target_box
    )
    
    game['last_shot'] = result
    emit('shot_fired', result)
    
    if result['hit_target']:
        damage = result['damage']
        opponent['health'] = max(0, opponent['health'] - damage)
        
        if opponent['health'] <= 0:
            game['phase'] = 'game_over'
            game['winner'] = player['id']
            emit('game_state', game)
            return
    
    game['current_player_id'] = opponent['id']
    game['phase'] = 'turn_end'
    emit('game_state', game)

@socketio.on('next_turn')
def handle_next_turn():
    sid = request.sid  # type: ignore
    game = games.get(sid)
    if not game:
        return
    
    game['wind'] = generate_wind()
    game['phase'] = 'aiming'
    game['predicted_trajectory'] = []
    update_trajectory_preview(game)
    emit('game_state', game)

@socketio.on('run_monte_carlo')
def handle_monte_carlo(data):
    sid = request.sid  # type: ignore
    game = games.get(sid)
    if not game:
        return
    
    player = next(p for p in game['players'] if p['id'] == game['current_player_id'])
    opponent = next(p for p in game['players'] if p['id'] != game['current_player_id'])
    
    target_box = {
        'min_x': opponent['position']['x'] - 1.5,
        'max_x': opponent['position']['x'] + 1.5,
        'min_y': opponent['position']['y'] - 1.0,
        'max_y': opponent['position']['y'] + 3.0
    }
    
    physics = PhysicsConfig(**game['physics_config'])
    physics.wind_speed = game['wind']['speed']
    physics.wind_direction = game['wind']['direction']
    
    result = monte_carlo_simulation(
        origin=player['position'],
        angle=player['angle'],
        power=player['power'],
        max_velocity=game['max_velocity'],
        physics=physics,
        terrain_height=game['terrain_height'],
        target_box=target_box,
        num_simulations=data.get('num_simulations', 100),
        wind_noise_std=data.get('wind_noise_std', 2.0),
        angle_noise_std=data.get('angle_noise_std', 1.0),
        power_noise_std=data.get('power_noise_std', 2.0)
    )
    
    emit('monte_carlo_result', result)

@socketio.on('get_ai_suggestion')
def handle_ai_suggestion(data):
    sid = request.sid  # type: ignore
    game = games.get(sid)
    if not game:
        return
    
    player = next(p for p in game['players'] if p['id'] == game['current_player_id'])
    opponent = next(p for p in game['players'] if p['id'] != game['current_player_id'])
    
    target_box = {
        'min_x': opponent['position']['x'] - 1.5,
        'max_x': opponent['position']['x'] + 1.5,
        'min_y': opponent['position']['y'] - 1.0,
        'max_y': opponent['position']['y'] + 3.0
    }
    
    physics = PhysicsConfig(**game['physics_config'])
    physics.wind_speed = game['wind']['speed']
    physics.wind_direction = game['wind']['direction']
    
    mode = data.get('mode', 'supervised')
    
    if mode == 'supervised':
        agent = SupervisedAgent()
        suggestion = agent.get_optimal_shot(
            origin=player['position'],
            target_box=target_box,
            max_velocity=game['max_velocity'],
            physics=physics,
            terrain_height=game['terrain_height']
        )
    else:
        agent = QLearningAgent()
        suggestion = agent.get_action(
            origin=player['position'],
            target_pos=opponent['position'],
            wind=game['wind']
        )
    
    emit('ai_suggestion', suggestion)

@socketio.on('run_guided_trajectory')
def handle_guided_trajectory(data):
    sid = request.sid  # type: ignore
    game = games.get(sid)
    if not game:
        return
    
    player = next(p for p in game['players'] if p['id'] == game['current_player_id'])
    opponent = next(p for p in game['players'] if p['id'] != game['current_player_id'])
    
    target_box = {
        'min_x': opponent['position']['x'] - 1.5,
        'max_x': opponent['position']['x'] + 1.5,
        'min_y': opponent['position']['y'] - 1.0,
        'max_y': opponent['position']['y'] + 3.0
    }
    
    physics = PhysicsConfig(**game['physics_config'])
    physics.wind_speed = game['wind']['speed']
    physics.wind_direction = game['wind']['direction']
    
    initial_velocity = calculate_initial_velocity(
        player['angle'], 
        player['power'], 
        game['max_velocity']
    )
    
    config = GuidanceConfig(
        max_impulses=data.get('max_impulses', 3),
        impulse_strength=data.get('impulse_strength', 5.0),
        correction_interval=data.get('correction_interval', 0.5)
    )
    
    result = simulate_guided_trajectory(
        origin=player['position'],
        initial_velocity=initial_velocity,
        target_box=target_box,
        physics=physics,
        config=config,
        terrain_height=game['terrain_height']
    )
    
    emit('guided_trajectory_result', result)

@socketio.on('get_sensor_estimate')
def handle_sensor_estimate(data):
    sid = request.sid  # type: ignore
    game = games.get(sid)
    if not game:
        return
    
    opponent = next(p for p in game['players'] if p['id'] != game['current_player_id'])
    filter_type = data.get('filter_type', 'kalman')
    noise_std = data.get('noise_std', 1.0)
    
    from server.ai.sensor_fusion import generate_noisy_measurement
    
    measurement = generate_noisy_measurement(
        opponent['position'],
        noise_std=noise_std,
        occlusion_probability=data.get('occlusion_prob', 0.1)
    )
    
    if 'sensor_filter' not in game:
        if filter_type == 'kalman':
            game['sensor_filter'] = KalmanFilter(measurement_noise=noise_std)
            game['sensor_filter'].initialize(opponent['position'])
        else:
            game['sensor_filter'] = ParticleFilter(measurement_noise=noise_std)
            game['sensor_filter'].initialize(opponent['position'])
        game['sensor_filter_type'] = filter_type
    
    if game.get('sensor_filter_type') != filter_type:
        if filter_type == 'kalman':
            game['sensor_filter'] = KalmanFilter(measurement_noise=noise_std)
            game['sensor_filter'].initialize(opponent['position'])
        else:
            game['sensor_filter'] = ParticleFilter(measurement_noise=noise_std)
            game['sensor_filter'].initialize(opponent['position'])
        game['sensor_filter_type'] = filter_type
    
    sensor_filter = game['sensor_filter']
    sensor_filter.predict()
    
    if measurement:
        sensor_filter.update(measurement)
    
    estimate = sensor_filter.get_estimate()
    
    emit('sensor_estimate', {
        'estimate': estimate,
        'true_position': opponent['position'],
        'measurement': measurement,
        'occluded': measurement is None
    })

def update_trajectory_preview(game):
    player = next(p for p in game['players'] if p['id'] == game['current_player_id'])
    
    physics = PhysicsConfig(**game['physics_config'])
    physics.wind_speed = game['wind']['speed']
    physics.wind_direction = game['wind']['direction']
    
    trajectory = predict_trajectory(
        origin=player['position'],
        angle=player['angle'],
        power=player['power'],
        max_velocity=game['max_velocity'],
        physics=physics,
        terrain_height=game['terrain_height']
    )
    
    game['predicted_trajectory'] = trajectory

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)
