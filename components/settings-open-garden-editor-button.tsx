"use client";

import { Building2, ChevronLeft } from "lucide-react";

export function SettingsOpenGardenEditorButton() {
  function openEditor() {
    const editor = document.getElementById("garden-editor");
    if (!(editor instanceof HTMLDetailsElement)) return;
    editor.open = true;
    const summary = editor.querySelector("summary");
    summary?.scrollIntoView({ block: "nearest" });
    summary?.focus();
  }

  return <button className="ux18-open-garden-editor" type="button" onClick={openEditor}>
    <Building2 aria-hidden="true" />
    <span><b>פרטי גן ושעות פעילות</b><small>שם, כתובת, קשר ולוח פעילות</small></span>
    <em>עריכה</em>
    <ChevronLeft aria-hidden="true" />
  </button>;
}
