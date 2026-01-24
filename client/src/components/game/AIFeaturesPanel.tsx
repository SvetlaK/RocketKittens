import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrajectoryLabPanel } from "./TrajectoryLab";
import { SmartYarnPanel } from "./SmartYarn";
import { AutopilotPanel } from "./AutopilotKitten";
import { FogOfYarnPanel } from "./FogOfYarn";

type AIFeature = "trajectory" | "smartyarn" | "autopilot" | "fog" | null;

export function AIFeaturesToggle() {
  const [activeFeature, setActiveFeature] = useState<AIFeature>(null);

  const toggleFeature = (feature: AIFeature) => {
    setActiveFeature(current => current === feature ? null : feature);
  };

  return (
    <>
      <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="bg-black/80 rounded-xl px-3 py-2 flex gap-2">
          <FeatureButton
            icon="🔬"
            label="Trajectory Lab"
            active={activeFeature === "trajectory"}
            onClick={() => toggleFeature("trajectory")}
            color="blue"
          />
          <FeatureButton
            icon="🎯"
            label="Smart Yarn"
            active={activeFeature === "smartyarn"}
            onClick={() => toggleFeature("smartyarn")}
            color="purple"
          />
          <FeatureButton
            icon="🤖"
            label="Autopilot"
            active={activeFeature === "autopilot"}
            onClick={() => toggleFeature("autopilot")}
            color="yellow"
          />
          <FeatureButton
            icon="📡"
            label="Fog of Yarn"
            active={activeFeature === "fog"}
            onClick={() => toggleFeature("fog")}
            color="cyan"
          />
        </div>
      </div>

      {activeFeature === "trajectory" && <TrajectoryLabPanel />}
      {activeFeature === "smartyarn" && <SmartYarnPanel />}
      {activeFeature === "autopilot" && <AutopilotPanel />}
      {activeFeature === "fog" && <FogOfYarnPanel />}
    </>
  );
}

interface FeatureButtonProps {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
  color: "blue" | "purple" | "yellow" | "cyan";
}

function FeatureButton({ icon, label, active, onClick, color }: FeatureButtonProps) {
  const colorClasses = {
    blue: active ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-blue-900",
    purple: active ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-purple-900",
    yellow: active ? "bg-yellow-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-yellow-900",
    cyan: active ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-cyan-900",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
        colorClasses[color]
      )}
    >
      <span>{icon}</span>
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
