"use client";

import { ArrowRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function DashboardBackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === fallbackHref) return null;

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button className="dashboard-back-button" type="button" onClick={goBack}>
      <ArrowRight size={18} />
      חזרה לעמוד הקודם
    </button>
  );
}
