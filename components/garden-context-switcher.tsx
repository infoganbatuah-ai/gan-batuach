"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Garden = { id: string; name: string; relationshipRole: string; isDefault: boolean };

export function GardenContextSwitcher({ gardens, initialActiveId }: { gardens: Garden[]; initialActiveId: string | null }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(initialActiveId ?? "");
  const [pending, setPending] = useState(false);

  if (gardens.length < 2) return null;
  return <label className="garden-context-switcher">
    <span>גן פעיל</span>
    <select value={activeId} disabled={pending} onChange={async event => {
      const gardenId = event.target.value;
      setPending(true);
      const response = await fetch("/api/management/gardens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ garden_id: gardenId }) });
      if (response.ok) { setActiveId(gardenId); router.refresh(); }
      setPending(false);
    }}>
      {!activeId && <option value="">בחירת גן</option>}
      {gardens.map(garden => <option value={garden.id} key={garden.id}>{garden.name}</option>)}
    </select>
  </label>;
}
