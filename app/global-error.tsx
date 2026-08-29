"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body style={{ margin: 0, background: "#f6f7fb", color: "#14213d", fontFamily: "Arial, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ maxWidth: 520, padding: 32, borderRadius: 20, background: "white", boxShadow: "0 20px 60px rgba(20,33,61,.12)", textAlign: "center" }}>
            <h1>אירעה תקלה זמנית</h1>
            <p>התקלה דווחה לצוות באופן אוטומטי. אפשר לנסות שוב כעת.</p>
            <button type="button" onClick={reset} style={{ border: 0, borderRadius: 12, padding: "12px 20px", background: "#2563eb", color: "white", cursor: "pointer" }}>
              ניסיון חוזר
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
