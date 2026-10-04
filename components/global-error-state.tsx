"use client";

import { useRouter } from "next/navigation";
import { GlobalStatePanel } from "@/components/global-state-system";

export function GlobalErrorState({ reset, title, description }: { reset?: () => void; title?: string; description?: string }) {
  const router = useRouter();
  return <GlobalStatePanel kind="error" title={title} description={description} action={<button className="button primary" type="button" onClick={() => reset?.()}>ניסיון נוסף</button>} secondaryAction={<button className="button secondary" type="button" onClick={() => router.push("/dashboard")}>חזרה לדף הבית</button>} />;
}
