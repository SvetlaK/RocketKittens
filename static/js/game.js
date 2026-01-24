const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameState = null;
let animatingShot = null;
let shotAnimationFrame = 0;

const GROUND_Y = canvas.height * 0.7;
const SCALE = 15;

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('game_state', (state) => {
    gameState = state;
    updateUI();
    render();
});

socket.on('shot_fired', (result) => {
    animatingShot = result;
    shotAnimationFrame = 0;
    animateShot();
});

socket.on('monte_carlo_result', (result) => {
    const resultDiv = document.getElementById('monte-carlo-result');
    resultDiv.innerHTML = `
        <div>Hit Probability: <strong>${(result.hit_probability * 100).toFixed(1)}%</strong></div>
        <div>Avg Distance: ${result.statistics.avg_distance.toFixed(1)}m</div>
        <div>Avg Flight Time: ${result.statistics.avg_flight_time.toFixed(2)}s</div>
    `;
    
    render();
    drawMonteCarloTrajectories(result.trajectories);
});

socket.on('ai_suggestion', (suggestion) => {
    const suggestionDiv = document.getElementById('ai-suggestion');
    const applyBtn = document.getElementById('applySuggestionBtn');
    
    suggestionDiv.innerHTML = `
        <div>Suggested Angle: <strong>${suggestion.angle.toFixed(1)}°</strong></div>
        <div>Suggested Power: <strong>${suggestion.power.toFixed(0)}%</strong></div>
        ${suggestion.is_hit !== undefined ? `<div>Predicted Hit: ${suggestion.is_hit ? 'Yes' : 'No'}</div>` : ''}
    `;
    
    applyBtn.classList.remove('hidden');
    applyBtn.onclick = () => {
        socket.emit('adjust_angle', { delta: suggestion.angle - getCurrentPlayer().angle });
        setTimeout(() => {
            socket.emit('adjust_power', { delta: suggestion.power - getCurrentPlayer().power });
            setTimeout(() => socket.emit('fire'), 200);
        }, 100);
    };
});

socket.on('guided_trajectory_result', (result) => {
    const resultDiv = document.getElementById('smart-yarn-result');
    if (resultDiv) {
        resultDiv.innerHTML = `
            <div>Hit Target: <strong>${result.hit_target ? 'Yes' : 'No'}</strong></div>
            <div>Impulses Used: ${result.impulses_applied.length}</div>
            <div>Remaining: ${result.impulses_remaining}</div>
            ${result.hit_target ? `<div>Damage: ${result.damage.toFixed(1)}</div>` : ''}
        `;
    }
    
    render();
    if (result.trajectory) {
        const points = result.trajectory.map(t => t.position);
        drawTrajectory(points, '#9b59b6', true);
        
        result.impulses_applied.forEach(imp => {
            const pos = worldToCanvas(imp.position.x, imp.position.y);
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
            ctx.fill();
        });
    }
});

socket.on('sensor_estimate', (data) => {
    const resultDiv = document.getElementById('fog-yarn-result');
    if (resultDiv) {
        const error = Math.sqrt(
            Math.pow(data.estimate.position.x - data.true_position.x, 2) +
            Math.pow(data.estimate.position.y - data.true_position.y, 2)
        );
        
        resultDiv.innerHTML = `
            <div>Estimated Position: (${data.estimate.position.x.toFixed(1)}, ${data.estimate.position.y.toFixed(1)})</div>
            <div>True Position: (${data.true_position.x.toFixed(1)}, ${data.true_position.y.toFixed(1)})</div>
            <div>Error: <strong>${error.toFixed(2)}m</strong></div>
            <div>Uncertainty: ${data.estimate.uncertainty.toFixed(2)}</div>
            <div>Occluded: ${data.occluded ? 'Yes' : 'No'}</div>
        `;
    }
    
    render();
    const estPos = worldToCanvas(data.estimate.position.x, data.estimate.position.y);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(estPos.x, estPos.y, 15 + data.estimate.uncertainty * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(estPos.x, estPos.y, 5, 0, Math.PI * 2);
    ctx.fill();
});

function getCurrentPlayer() {
    if (!gameState) return null;
    return gameState.players.find(p => p.id === gameState.current_player_id);
}

function updateUI() {
    if (!gameState) return;
    
    const menu = document.getElementById('menu');
    const gameOver = document.getElementById('game-over');
    const hud = document.getElementById('hud');
    const aiPanel = document.getElementById('ai-panel');
    const turnEndPanel = document.getElementById('turn-end-panel');
    
    menu.classList.toggle('hidden', gameState.phase !== 'menu');
    gameOver.classList.toggle('hidden', gameState.phase !== 'game_over');
    hud.classList.toggle('hidden', gameState.phase === 'menu' || gameState.phase === 'game_over');
    aiPanel.classList.toggle('hidden', gameState.phase !== 'aiming');
    turnEndPanel.classList.toggle('hidden', gameState.phase !== 'turn_end');
    
    if (gameState.phase === 'game_over') {
        const winner = gameState.players.find(p => p.id === gameState.winner);
        document.getElementById('winner-text').textContent = 
            `${winner.id === 'player1' ? 'Red' : 'Blue'} Kitten Wins!`;
    }
    
    const currentPlayer = getCurrentPlayer();
    if (currentPlayer) {
        document.getElementById('current-player').textContent = 
            `${currentPlayer.id === 'player1' ? 'Red' : 'Blue'} Kitten's Turn`;
        document.getElementById('current-player').style.color = currentPlayer.color;
        
        document.getElementById('angle-display').textContent = currentPlayer.angle.toFixed(0);
        document.getElementById('power-display').textContent = currentPlayer.power.toFixed(0);
    }
    
    if (gameState.wind) {
        const windDir = gameState.wind.direction === 0 ? '→' : '←';
        document.getElementById('wind-info').textContent = 
            `Wind: ${gameState.wind.speed.toFixed(1)} ${windDir}`;
    }
    
    gameState.players.forEach(player => {
        const healthBar = document.getElementById(`${player.id}-health`);
        const fill = healthBar.querySelector('.health-fill');
        fill.style.width = `${(player.health / player.max_health) * 100}%`;
    });
}

function worldToCanvas(x, y) {
    return {
        x: canvas.width / 2 + x * SCALE,
        y: GROUND_Y - y * SCALE
    };
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(0.6, '#B0E0E6');
    gradient.addColorStop(0.7, '#228B22');
    gradient.addColorStop(1, '#32CD32');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (!gameState) return;
    
    gameState.players.forEach(player => {
        drawKitten(player);
    });
    
    if (gameState.predicted_trajectory && gameState.predicted_trajectory.length > 0 && 
        gameState.phase === 'aiming') {
        drawTrajectory(gameState.predicted_trajectory, 'rgba(255, 255, 255, 0.6)', true);
    }
    
    if (gameState.last_shot && gameState.phase === 'turn_end') {
        const points = gameState.last_shot.trajectory.map(t => t.position);
        const color = gameState.last_shot.hit_target ? '#e74c3c' : '#95a5a6';
        drawTrajectory(points, color, false);
    }
}

function drawKitten(player) {
    const pos = worldToCanvas(player.position.x, player.position.y);
    
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y - 20, 25, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(pos.x - 20, pos.y - 45);
    ctx.lineTo(pos.x - 10, pos.y - 25);
    ctx.lineTo(pos.x - 5, pos.y - 40);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(pos.x + 20, pos.y - 45);
    ctx.lineTo(pos.x + 10, pos.y - 25);
    ctx.lineTo(pos.x + 5, pos.y - 40);
    ctx.fill();
    
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(pos.x - 8, pos.y - 25, 6, 0, Math.PI * 2);
    ctx.arc(pos.x + 8, pos.y - 25, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(pos.x - 8, pos.y - 25, 3, 0, Math.PI * 2);
    ctx.arc(pos.x + 8, pos.y - 25, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ffb6c1';
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y - 15, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    if (player.id === gameState.current_player_id && gameState.phase === 'aiming') {
        const angleRad = player.angle * Math.PI / 180;
        const aimLength = 40 + (player.power / 100) * 30;
        
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - 20);
        ctx.lineTo(
            pos.x + Math.cos(angleRad) * aimLength * (player.facing_right ? 1 : -1),
            pos.y - 20 - Math.sin(angleRad) * aimLength
        );
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function drawTrajectory(points, color, dashed) {
    if (points.length < 2) return;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (dashed) ctx.setLineDash([8, 4]);
    
    ctx.beginPath();
    const start = worldToCanvas(points[0].x, points[0].y);
    ctx.moveTo(start.x, start.y);
    
    for (let i = 1; i < points.length; i++) {
        const p = worldToCanvas(points[i].x, points[i].y);
        ctx.lineTo(p.x, p.y);
    }
    
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawMonteCarloTrajectories(trajectories) {
    trajectories.forEach(traj => {
        const color = traj.hit ? 'rgba(46, 204, 113, 0.3)' : 'rgba(231, 76, 60, 0.2)';
        drawTrajectory(traj.points, color, false);
    });
}

function animateShot() {
    if (!animatingShot || shotAnimationFrame >= animatingShot.trajectory.length) {
        animatingShot = null;
        return;
    }
    
    render();
    
    const point = animatingShot.trajectory[shotAnimationFrame];
    const pos = worldToCanvas(point.position.x, point.position.y);
    
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const startIdx = Math.max(0, shotAnimationFrame - 20);
    for (let i = startIdx; i <= shotAnimationFrame; i++) {
        const p = animatingShot.trajectory[i];
        const canvasPos = worldToCanvas(p.position.x, p.position.y);
        if (i === startIdx) {
            ctx.moveTo(canvasPos.x, canvasPos.y);
        } else {
            ctx.lineTo(canvasPos.x, canvasPos.y);
        }
    }
    ctx.stroke();
    
    shotAnimationFrame += 2;
    requestAnimationFrame(animateShot);
}

document.getElementById('startBtn').addEventListener('click', () => {
    socket.emit('start_game');
});

document.getElementById('restartBtn').addEventListener('click', () => {
    socket.emit('start_game');
});

document.getElementById('nextTurnBtn').addEventListener('click', () => {
    socket.emit('next_turn');
});

document.addEventListener('keydown', (e) => {
    if (!gameState || gameState.phase !== 'aiming') return;
    
    switch(e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
            socket.emit('adjust_angle', { delta: 2 });
            break;
        case 's':
        case 'arrowdown':
            socket.emit('adjust_angle', { delta: -2 });
            break;
        case 'd':
        case 'arrowright':
            socket.emit('adjust_power', { delta: 3 });
            break;
        case 'a':
        case 'arrowleft':
            socket.emit('adjust_power', { delta: -3 });
            break;
        case ' ':
            e.preventDefault();
            socket.emit('fire');
            break;
    }
});


document.getElementById('num-sims').addEventListener('input', (e) => {
    document.getElementById('num-sims-display').textContent = e.target.value;
});

document.getElementById('runMonteCarloBtn').addEventListener('click', () => {
    const numSims = parseInt(document.getElementById('num-sims').value);
    socket.emit('run_monte_carlo', { num_simulations: numSims });
});

document.getElementById('getSuggestionBtn').addEventListener('click', () => {
    const mode = document.getElementById('ai-mode').value;
    socket.emit('get_ai_suggestion', { mode });
});

document.getElementById('max-impulses').addEventListener('input', (e) => {
    document.getElementById('impulses-display').textContent = e.target.value;
});

document.getElementById('impulse-strength').addEventListener('input', (e) => {
    document.getElementById('strength-display').textContent = e.target.value;
});

document.getElementById('runGuidedBtn').addEventListener('click', () => {
    const maxImpulses = parseInt(document.getElementById('max-impulses').value);
    const strength = parseFloat(document.getElementById('impulse-strength').value);
    socket.emit('run_guided_trajectory', { 
        max_impulses: maxImpulses, 
        impulse_strength: strength 
    });
});

document.getElementById('noise-level').addEventListener('input', (e) => {
    document.getElementById('noise-display').textContent = e.target.value;
});

document.getElementById('updateEstimateBtn').addEventListener('click', () => {
    const filterType = document.getElementById('filter-type').value;
    const noiseStd = parseFloat(document.getElementById('noise-level').value);
    socket.emit('get_sensor_estimate', { 
        filter_type: filterType, 
        noise_std: noiseStd 
    });
});

document.querySelectorAll('.ai-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.ai-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.ai-feature').forEach(f => f.classList.add('hidden'));
        
        btn.classList.add('active');
        
        const panelId = {
            'trajectoryLabBtn': 'trajectory-lab',
            'autopilotBtn': 'autopilot-panel',
            'smartYarnBtn': 'smart-yarn-panel',
            'fogOfYarnBtn': 'fog-yarn-panel'
        }[btn.id];
        
        if (panelId) {
            document.getElementById(panelId).classList.remove('hidden');
        }
    });
});

render();
