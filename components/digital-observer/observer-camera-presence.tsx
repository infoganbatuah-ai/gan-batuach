import Image from "next/image";

export function ObserverCameraPresence({ active = true }: { active?: boolean }) {
  return <span className={`do-camera-observer-presence ${active ? "active" : ""}`} title={active ? "התצפיתן הדיגיטלי פעיל במצלמה זו" : "התצפיתן הדיגיטלי כבוי במצלמה זו כי אין זרם חי תקין"}>
    <Image src="/assets/digital-observer/observer-robot-v1.png" alt="" width={84} height={84} />
    <i />
    <small>{active ? "תצפיתן פעיל" : "תצפיתן כבוי"}</small>
  </span>;
}
