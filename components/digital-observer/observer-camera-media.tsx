import { CameraOff, CircleDot, Play, ShieldCheck } from "lucide-react";

export function ObserverCameraMedia({
  name,
  scene,
  mode,
  status = "readiness",
  large = false
}: {
  name: string;
  scene?: string | null;
  mode: "home" | "business";
  status?: string | null;
  large?: boolean;
}) {
  const active = ["connected", "healthy", "online", "active"].includes(String(status));
  const position = scene || (mode === "home" ? "home-living" : "business-entry");
  return (
    <div className={`do-camera-media ${large ? "large" : ""} scene-${position}`}>
      <span className={active ? "do-camera-status active" : "do-camera-status readiness"}>
        {active ? <CircleDot /> : <ShieldCheck />}{active ? "מחוברת" : "מצב בדיקה"}
      </span>
      <span className="do-camera-name">{name}</span>
      {!active ? <span className="do-camera-lock"><CameraOff /><small>אין שידור חי עד חיבור Gateway</small></span> : <span className="do-camera-play"><Play fill="currentColor" /></span>}
    </div>
  );
}

