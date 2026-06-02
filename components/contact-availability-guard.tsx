"use client";

import { useEffect, useState } from "react";

export function ContactAvailabilityGuard({ emailName = "email", phoneName = "phone" }: { emailName?: string; phoneName?: string }) {
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const container = document.currentScript?.parentElement;
    const form = container?.closest("form") ?? document.querySelector("form");
    if (!form) return;
    const email = form.querySelector<HTMLInputElement>(`[name="${emailName}"]`);
    const phone = form.querySelector<HTMLInputElement>(`[name="${phoneName}"]`);
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function validate() {
      const payload = { email: email?.value || undefined, phone: phone?.value || undefined };
      if (!payload.email && !payload.phone) { setMessage(""); setBlocked(false); return; }
      try {
        const response = await fetch("/api/public/validate-contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const body = await response.json();
        const emailExists = Boolean(body.data?.email_exists);
        const phoneExists = Boolean(body.data?.phone_exists);
        setBlocked(emailExists || phoneExists);
        setMessage(emailExists ? "המייל כבר קיים במערכת" : phoneExists ? "הטלפון כבר קיים במערכת" : "הפרטים פנויים להמשך");
      } catch {
        setMessage("");
        setBlocked(false);
      }
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(validate, 450);
    }
    function block(event: Event) {
      if (blocked) {
        event.preventDefault();
        setMessage(message || "המייל כבר קיים במערכת");
      }
    }

    email?.addEventListener("input", schedule);
    phone?.addEventListener("input", schedule);
    form.addEventListener("submit", block);
    return () => {
      if (timer) clearTimeout(timer);
      email?.removeEventListener("input", schedule);
      phone?.removeEventListener("input", schedule);
      form.removeEventListener("submit", block);
    };
  }, [emailName, phoneName, blocked, message]);

  if (!message) return null;
  return <div className={blocked ? "error-banner" : "success-banner"}>{message}</div>;
}
