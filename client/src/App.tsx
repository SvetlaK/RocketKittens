import { useRocketKittens } from "./lib/stores/useRocketKittens";
import { GameScene, GameUI, MenuScreen, GameOverScreen, SoundManager } from "./components/game";
import "@fontsource/inter";

function App() {
  const { phase } = useRocketKittens();

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {phase === "menu" && <MenuScreen />}
      
      {phase !== "menu" && (
        <>
          <GameScene />
          <GameUI />
        </>
      )}
      
      {phase === "game_over" && <GameOverScreen />}
      
      <SoundManager />
    </div>
  );
}

export default App;
