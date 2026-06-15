"use client";

import { useFormStatus } from "react-dom";
import { LogIn } from "lucide-react";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button primary large" disabled={pending} type="submit">
      <LogIn size={16} /> {pending ? "מתחבר..." : "התחברות"}
    </button>
  );
}
