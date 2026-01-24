import { Suspense, useEffect, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, KeyboardControls, useKeyboardControls } from "@react-three/drei";
import { useRocketKittens } from "@/lib/stores/useRocketKittens";
import { useAudio } from "@/lib/stores/useAudio";
import { 
  simulateTrajectory, 
  predictTrajectory, 
  calculateDamage,
  ShotResult,
  Vector2D,
} from "@/lib/physics/ballistics";
import { Terrain, Sky, Clouds } from "./Terrain";
import { Kitten, HealthBar3D } from "./Kitten";
import { YarnBall, TrajectoryPreview, ActualTrajectory, ImpactEffect } from "./YarnBall";

enum Controls {
  angleUp = "angleUp",
  angleDown = "angleDown",
  powerUp = "powerUp",
  powerDown = "powerDown",
  fire = "fire",
}

const keyMap = [
  { name: Controls.angleUp, keys: ["KeyW", "ArrowUp"] },
  { name: Controls.angleDown, keys: ["KeyS", "ArrowDown"] },
  { name: Controls.powerUp, keys: ["KeyD", "ArrowRight"] },
  { name: Controls.powerDown, keys: ["KeyA", "ArrowLeft"] },
  { name: Controls.fire, keys: ["Space"] },
];

export function GameScene() {
  const { phase } = useRocketKittens();

  if (phase === "menu") return null;

  return (
    <KeyboardControls map={keyMap}>
      <Canvas
        shadows
        camera={{
          position: [20, 8, 25],
          fov: 50,
          near: 0.1,
          far: 200,
        }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#87CEEB"]} />
        
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={50}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        
        <Suspense fallback={null}>
          <GameWorld />
        </Suspense>
        
        <OrbitControls 
          enablePan={false}
          minDistance={15}
          maxDistance={50}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.5}
          target={[20, 5, 0]}
        />
      </Canvas>
      
      <GameControls />
    </KeyboardControls>
  );
}

function GameWorld() {
  const {
    players,
    currentPlayerId,
    phase,
    physicsConfig,
    terrainHeight,
    maxVelocity,
    showTrajectoryPreview,
    predictedTrajectory,
    lastShot,
    setPredictedTrajectory,
    setLastShot,
    setPhase,
    applyDamage,
    nextTurn,
    recordShot,
    getOpponent,
    getPlayerCollisionBox,
  } = useRocketKittens();

  const { playHit, playSuccess } = useAudio();
  
  const [activeShot, setActiveShot] = useState<ShotResult | null>(null);
  const [impactPosition, setImpactPosition] = useState<Vector2D | null>(null);
  const [showImpact, setShowImpact] = useState(false);

  const currentPlayer = players.find(p => p.id === currentPlayerId);

  useEffect(() => {
    if (phase === "aiming" && currentPlayer && showTrajectoryPreview) {
      const predicted = predictTrajectory(
        {
          origin: currentPlayer.position,
          angle: currentPlayer.angle,
          power: currentPlayer.power,
          maxVelocity,
        },
        physicsConfig,
        terrainHeight
      );
      setPredictedTrajectory(predicted);
    } else if (!showTrajectoryPreview) {
      setPredictedTrajectory([]);
    }
  }, [
    phase, 
    currentPlayer?.angle, 
    currentPlayer?.power, 
    physicsConfig, 
    showTrajectoryPreview,
    currentPlayer,
    maxVelocity,
    terrainHeight,
    setPredictedTrajectory,
  ]);

  useEffect(() => {
    if (phase === "shooting" && currentPlayer) {
      const opponent = getOpponent();
      const targetBox = getPlayerCollisionBox(opponent.id);
      
      const result = simulateTrajectory(
        {
          origin: currentPlayer.position,
          angle: currentPlayer.angle,
          power: currentPlayer.power,
          maxVelocity,
        },
        physicsConfig,
        terrainHeight,
        targetBox
      );
      
      recordShot({
        playerId: currentPlayerId,
        params: {
          origin: currentPlayer.position,
          angle: currentPlayer.angle,
          power: currentPlayer.power,
        },
        config: physicsConfig,
        result,
        predictedTrajectory,
      });
      
      setActiveShot(result);
      setLastShot(result);
    }
  }, [phase]);

  const handleShotComplete = useCallback(() => {
    if (!activeShot) return;
    
    setImpactPosition(activeShot.finalPosition);
    setShowImpact(true);
    
    if (activeShot.hitTarget) {
      const damage = calculateDamage(activeShot.impactVelocity);
      const opponent = getOpponent();
      applyDamage(opponent.id, damage);
      playHit();
      
      console.log(`Hit! Dealt ${damage} damage to ${opponent.name}`);
    } else {
      console.log("Miss! The yarn ball landed on the ground.");
    }
    
    setActiveShot(null);
    setPhase("turn_end");
    
    setTimeout(() => {
      setShowImpact(false);
      setImpactPosition(null);
      nextTurn();
    }, 1500);
  }, [activeShot, applyDamage, getOpponent, nextTurn, playHit, setPhase]);

  return (
    <>
      <Sky />
      <Clouds />
      <Terrain width={50} depth={10} />
      
      {players.map((player) => (
        <Kitten
          key={player.id}
          player={player}
          isActive={player.id === currentPlayerId && phase === "aiming"}
        />
      ))}
      
      {players.map((player) => (
        <HealthBar3D key={`health-${player.id}`} player={player} />
      ))}
      
      {showTrajectoryPreview && predictedTrajectory.length > 0 && phase === "aiming" && (
        <TrajectoryPreview 
          points={predictedTrajectory} 
          color={currentPlayer?.color || "#ffffff"}
          dashed={true}
        />
      )}
      
      {activeShot && (
        <YarnBall
          trajectory={activeShot.trajectory}
          color="#f39c12"
          onComplete={handleShotComplete}
          playbackSpeed={1.5}
        />
      )}
      
      {lastShot && phase === "turn_end" && (
        <ActualTrajectory 
          trajectory={lastShot.trajectory}
          color={activeShot?.hitTarget ? "#e74c3c" : "#95a5a6"}
        />
      )}
      
      {showImpact && impactPosition && (
        <ImpactEffect 
          position={impactPosition}
          hit={lastShot?.hitTarget || false}
        />
      )}
    </>
  );
}

function GameControls() {
  const { 
    phase, 
    adjustAngle, 
    adjustPower,
    setPhase,
  } = useRocketKittens();
  
  const [, getKeys] = useKeyboardControls<Controls>();

  useEffect(() => {
    if (phase !== "aiming") return;

    const handleKeyboard = () => {
      const keys = getKeys();
      
      if (keys.angleUp) adjustAngle(1);
      if (keys.angleDown) adjustAngle(-1);
      if (keys.powerUp) adjustPower(2);
      if (keys.powerDown) adjustPower(-2);
      if (keys.fire) {
        setPhase("shooting");
      }
    };

    const interval = setInterval(handleKeyboard, 50);
    return () => clearInterval(interval);
  }, [phase, adjustAngle, adjustPower, getKeys, setPhase]);

  return null;
}
