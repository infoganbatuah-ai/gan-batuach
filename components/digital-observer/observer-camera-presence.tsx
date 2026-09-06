import Image from "next/image";

// Existing callers pass hasLiveGateway, not evidence of successful AI analysis.
// Connection state must never be promoted to a claim of active protection.
export function ObserverCameraPresence({ active = false }: { active?: boolean }) {
  return <span className={`do-camera-observer-presence ${active ? "active" : ""}`} title={active ? "המקור מדווח כמחובר לווידאו. מצב ניתוח התצפיתן טרם אומת מתג זה." : "תצפיתן כבוי. חיבור הווידאו אינו מאומת. תג זה אינו קובע את מצב מנוע הניתוח."}>
    <Image src="/assets/digital-observer/observer-robot-v1.png" alt="" width={84} height={84} />
    <i />
    <small>{active ? "חיבור וידאו מדווח" : "תצפיתן כבוי — חיבור לא מאומת"}</small>
  </span>;
}
