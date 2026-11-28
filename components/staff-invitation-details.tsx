"use client";

import { useEffect, useRef } from "react";
import { StaffInvitationForm } from "@/components/staff-invitation-form";

export function StaffInvitationDetails({
  openings,
  openOnArrival,
}: {
  openings: Array<{ id: string; role_needed: string }>;
  openOnArrival: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!openOnArrival) return;
    const details = detailsRef.current;
    if (!details) return;
    details.open = true;
    const summary = details.querySelector("summary");
    summary?.scrollIntoView({ block: "nearest" });
    summary?.focus();
  }, [openOnArrival]);

  return <details ref={detailsRef}>
    <summary>פתיחת טופס הזמנה</summary>
    <StaffInvitationForm openings={openings} />
  </details>;
}
