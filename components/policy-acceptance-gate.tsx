"use client";

import { useEffect, useState } from "react";

type Policy = { id: string; title: string; body: string; version: number };

export function PolicyAcceptanceGate() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/policies/required").then((r) => r.json()).then((body) => {
      setPolicy(body.data?.required ? body.data.policy : null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  async function accept() {
    await fetch("/api/policies/required", { method: "POST" });
    setPolicy(null);
  }
  if (loading || !policy) return null;
  return <div className="policy-gate"><div className="card policy-modal"><p className="eyebrow">אישור תקנון</p><h2>{policy.title} · גרסה {policy.version}</h2><p>{policy.body}</p><button className="button primary large" onClick={accept}>קראתי ואני מאשר/ת</button></div></div>;
}
