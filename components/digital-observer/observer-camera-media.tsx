import { Camera, CameraOff, CircleDot, ShieldCheck } from "lucide-react";

export function ObserverCameraMedia({
  name,
  scene,
  mode,
  status = "readiness",
  sourceMode,
  large = false
}: {
  name: string;
  scene?: string | null;
  mode: "home" | "business";
  status?: string | null;
  sourceMode?: string | null;
  large?: boolean;
}) {
  const connected = ["connected", "healthy", "online", "active"].includes(String(status));
  const demo = sourceMode === "demo";
  const position = scene || (mode === "home" ? "home-living" : "business-entry");
  return (
    <div className={`do-camera-media ${large ? "large" : ""} ${demo ? `is-demo scene-${position}` : "is-readiness"}`}>
      <span className={connected ? "do-camera-status active" : "do-camera-status readiness"}>
        {connected ? <CircleDot /> : <ShieldCheck />}{connected ? "מקור מחובר" : demo ? "הדמיה" : "מצב בדיקה"}
      </span>
      <span className="do-camera-name">{name}</span>
      {demo
        ? <span className="do-camera-footnote"><Camera /><small>תרחיש הדגמה בלבד · לא שידור חי</small></span>
        : connected
          ? <span className="do-camera-lock"><Camera /><small>המקור מחובר; הצפייה דורשת stream token מאובטח</small></span>
          : <span className="do-camera-lock"><CameraOff /><small>אין שידור חי עד חיבור Gateway</small></span>}
    </div>
  );
}
