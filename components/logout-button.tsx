"use client";

import { LogOut } from "lucide-react";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <button
      className={`button secondary tiny logout-button${compact ? " compact" : ""}`}
      type="button"
      onClick={logout}
      title="התנתקות"
      aria-label="התנתקות"
    >
      <LogOut size={19} />
      <span>התנתקות</span>
    </button>
  );
}
