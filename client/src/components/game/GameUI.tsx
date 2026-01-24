import { useRocketKittens, Player } from "@/lib/stores/useRocketKittens";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { AIFeaturesToggle } from "./AIFeaturesPanel";

export function GameUI() {
  const { 
    phase, 
    players, 
    currentPlayerId, 
    turn, 
    wind,
    showTrajectoryPreview,
    toggleTrajectoryPreview,
  } = useRocketKittens();

  const currentPlayer = players.find(p => p.id === currentPlayerId);

  if (phase === "menu" || phase === "game_over") return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <TopBar 
        turn={turn} 
        wind={wind} 
        players={players}
        currentPlayerId={currentPlayerId}
      />
      
      {(phase === "aiming" || phase === "shooting" || phase === "turn_end") && (
        <AIFeaturesToggle />
      )}
      
      {currentPlayer && (phase === "aiming" || phase === "shooting") && (
        <ControlPanel 
          player={currentPlayer}
          showTrajectoryPreview={showTrajectoryPreview}
          onTogglePreview={toggleTrajectoryPreview}
        />
      )}
      
      <PlayerHealthBars players={players} />
    </div>
  );
}

interface TopBarProps {
  turn: number;
  wind: number;
  players: Player[];
  currentPlayerId: number;
}

function TopBar({ turn, wind, players, currentPlayerId }: TopBarProps) {
  const windDirection = wind >= 0 ? "→" : "←";
  const windStrength = Math.abs(wind);
  
  let windLabel = "Calm";
  if (windStrength > 6) windLabel = "Strong";
  else if (windStrength > 3) windLabel = "Moderate";
  else if (windStrength > 1) windLabel = "Light";

  const currentPlayer = players.find(p => p.id === currentPlayerId);

  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none">
      <div className="bg-black/70 rounded-lg px-4 py-2 text-white">
        <div className="text-sm opacity-70">Turn {turn}</div>
        <div className="text-lg font-bold" style={{ color: currentPlayer?.color }}>
          {currentPlayer?.name}'s Turn
        </div>
      </div>
      
      <div className="bg-black/70 rounded-lg px-4 py-2 text-white text-center">
        <div className="text-sm opacity-70">Wind</div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{windDirection}</span>
          <span className="text-lg font-bold">{windStrength.toFixed(1)} m/s</span>
        </div>
        <div className="text-xs opacity-70">{windLabel}</div>
      </div>
    </div>
  );
}

interface ControlPanelProps {
  player: Player;
  showTrajectoryPreview: boolean;
  onTogglePreview: () => void;
}

function ControlPanel({ player, showTrajectoryPreview, onTogglePreview }: ControlPanelProps) {
  const { 
    setAngle, 
    setPower, 
    setPhase,
    phase,
  } = useRocketKittens();

  const handleFire = () => {
    if (phase === "aiming") {
      setPhase("shooting");
    }
  };

  const isAiming = phase === "aiming";

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
      <div className="bg-black/80 rounded-xl p-4 min-w-[400px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg" style={{ color: player.color }}>
            {player.name}
          </h3>
          <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
            <input 
              type="checkbox" 
              checked={showTrajectoryPreview}
              onChange={onTogglePreview}
              className="rounded"
            />
            Show Trajectory
          </label>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-white text-sm">
              <span>Angle</span>
              <span className="font-mono">{player.angle.toFixed(0)}°</span>
            </div>
            <Slider
              value={[player.angle]}
              onValueChange={([val]) => setAngle(player.id, val)}
              min={0}
              max={180}
              step={1}
              disabled={!isAiming}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-white text-sm">
              <span>Power</span>
              <span className="font-mono">{player.power.toFixed(0)}%</span>
            </div>
            <div className="relative">
              <Slider
                value={[player.power]}
                onValueChange={([val]) => setPower(player.id, val)}
                min={5}
                max={100}
                step={1}
                disabled={!isAiming}
                className="w-full"
              />
              <div 
                className="absolute top-0 left-0 h-full rounded-full transition-all pointer-events-none"
                style={{
                  width: `${player.power}%`,
                  background: `linear-gradient(90deg, #27ae60 0%, #f1c40f 50%, #e74c3c 100%)`,
                  opacity: 0.3,
                }}
              />
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex gap-2">
          <Button
            onClick={handleFire}
            disabled={!isAiming}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2"
          >
            Fire!
          </Button>
        </div>
        
        <div className="mt-2 text-white/60 text-xs text-center">
          Use W/S or Up/Down to adjust angle, A/D or Left/Right for power
        </div>
      </div>
    </div>
  );
}

interface PlayerHealthBarsProps {
  players: Player[];
}

function PlayerHealthBars({ players }: PlayerHealthBarsProps) {
  return (
    <div className="absolute top-4 left-0 right-0 flex justify-center gap-8 pointer-events-none">
      {players.map((player) => (
        <div 
          key={player.id}
          className="bg-black/70 rounded-lg px-4 py-2 min-w-[150px]"
        >
          <div 
            className="text-sm font-bold mb-1"
            style={{ color: player.color }}
          >
            {player.name}
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-300",
                player.health > 60 ? "bg-green-500" :
                player.health > 30 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${(player.health / player.maxHealth) * 100}%` }}
            />
          </div>
          <div className="text-white text-xs text-right mt-1">
            {player.health}/{player.maxHealth}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MenuScreen() {
  const { startGame } = useRocketKittens();

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-sky-400 to-sky-600">
      <div className="bg-white/90 rounded-2xl p-8 shadow-2xl text-center max-w-md">
        <h1 className="text-5xl font-bold text-orange-500 mb-2">
          RocketKittens
        </h1>
        <p className="text-gray-600 mb-6">
          An artillery game with aerospace-inspired physics
        </p>
        
        <div className="mb-6 text-left bg-gray-100 rounded-lg p-4">
          <h3 className="font-bold text-gray-800 mb-2">How to Play:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Adjust angle and power to aim your yarn ball</li>
            <li>• Account for wind affecting your shot</li>
            <li>• Hit the opponent kitten to deal damage</li>
            <li>• First to reduce opponent's health to 0 wins!</li>
          </ul>
        </div>
        
        <div className="mb-6 text-left bg-blue-50 rounded-lg p-4">
          <h3 className="font-bold text-blue-800 mb-2">Controls:</h3>
          <ul className="text-sm text-blue-600 space-y-1">
            <li>• W/S or Up/Down: Adjust angle</li>
            <li>• A/D or Left/Right: Adjust power</li>
            <li>• Space: Fire!</li>
          </ul>
        </div>
        
        <Button 
          onClick={startGame}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xl py-6"
        >
          Start Game
        </Button>
      </div>
    </div>
  );
}

export function GameOverScreen() {
  const { winner, players, resetGame, startGame } = useRocketKittens();
  const winningPlayer = players.find(p => p.id === winner);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-md">
        <h2 className="text-4xl font-bold mb-4" style={{ color: winningPlayer?.color }}>
          {winningPlayer?.name} Wins!
        </h2>
        
        <p className="text-gray-600 mb-6">
          The battle is over. Will you fight again?
        </p>
        
        <div className="flex gap-4">
          <Button 
            onClick={startGame}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold"
          >
            Play Again
          </Button>
          <Button 
            onClick={resetGame}
            variant="outline"
            className="flex-1"
          >
            Main Menu
          </Button>
        </div>
      </div>
    </div>
  );
}
