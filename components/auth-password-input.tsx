"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export function AuthPasswordInput() {
  const [visible, setVisible] = useState(false);
  return (
    <label className="gb-reference-field">
      <span className="sr-only">סיסמה</span>
      <input name="password" type={visible ? "text" : "password"} required placeholder="סיסמה" autoComplete="current-password" />
      <span className="gb-reference-field-icon" aria-hidden="true"><Lock size={27} /></span>
      <button className="gb-reference-field-eye" type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "הסתרת סיסמה" : "הצגת סיסמה"}>
        {visible ? <EyeOff size={22} /> : <Eye size={22} />}
      </button>
    </label>
  );
}
