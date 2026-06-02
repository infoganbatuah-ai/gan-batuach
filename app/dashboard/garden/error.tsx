"use client";

import { DashboardErrorState } from "@/components/dashboard-error-state";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardErrorState reset={reset} />;
}
