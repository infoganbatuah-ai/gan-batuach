"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ObserverJournalRefresh({ latestId, severity }: { latestId?: string; severity?: string }) {
  const router = useRouter();
  const previous = useRef(latestId);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !pending) startTransition(() => router.refresh());
    }, 15_000);
    return () => clearInterval(timer);
  }, [router, pending]);
  useEffect(() => {
    if (latestId && latestId !== previous.current && ["critical", "urgent", "high", "medium"].includes(severity || "")) setMessage("התקבל אירוע חדש שדורש בדיקה ביומן.");
    previous.current = latestId;
  }, [latestId, severity]);
  return message ? <div className="do-notice warn" role="status" aria-live="polite">{message}<button type="button" onClick={() => setMessage("")}>סגירה</button></div> : null;
}
