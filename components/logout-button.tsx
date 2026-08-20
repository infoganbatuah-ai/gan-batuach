"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function LogoutButton({
  compact = false,
  redirectTo = "/login",
  className
}: {
  compact?: boolean;
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.sessionStorage.removeItem("digital_observer_session_access");
    router.replace(redirectTo);
    router.refresh();
  }
  return (
    <button
      className={className ?? `button secondary tiny logout-button${compact ? " compact" : ""}`}
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
