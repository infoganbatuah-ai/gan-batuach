"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, LoaderCircle } from "lucide-react";

type Garden = { id: string; name: string; relationshipRole: string; isDefault: boolean };

export function GardenContextSwitcher({ gardens, initialActiveId, compact = false }: { gardens: Garden[]; initialActiveId: string | null; compact?: boolean }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(initialActiveId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const activeGarden = gardens.find((garden) => garden.id === activeId) ?? gardens[0];

  if (!gardens.length) return null;
  if (gardens.length === 1) {
    return <div className={`garden-context-switcher garden-context-single${compact ? " compact" : ""}`} aria-label={`גן פעיל: ${activeGarden.name}`}>
      <Building2 size={20} aria-hidden="true" />
      <span><small>גן פעיל</small><b>{activeGarden.name}</b></span>
    </div>;
  }

  return <label className={`garden-context-switcher${compact ? " compact" : ""}`}>
    <Building2 size={20} aria-hidden="true" />
    <span><small>גן פעיל</small><b>{activeGarden?.name ?? "בחירת גן"}</b></span>
    <select aria-label="החלפת גן פעיל" value={activeId} disabled={pending} onChange={async event => {
      const gardenId = event.target.value;
      setPending(true);
      setError("");
      const response = await fetch("/api/management/gardens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ garden_id: gardenId }) });
      if (response.ok) {
        setActiveId(gardenId);
        router.refresh();
      } else {
        setError("לא ניתן להחליף גן כרגע");
      }
      setPending(false);
    }}>
      {!activeId && <option value="">בחירת גן</option>}
      {gardens.map(garden => <option value={garden.id} key={garden.id}>{garden.name}</option>)}
    </select>
    {pending ? <LoaderCircle className="garden-context-spinner" size={18} aria-label="מחליף גן" /> : <ChevronDown size={18} aria-hidden="true" />}
    {error ? <em role="alert">{error}</em> : null}
  </label>;
}
