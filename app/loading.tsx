import { GlobalLoadingState } from "@/components/global-state-system";

export default function Loading() {
  return <main className="loading-screen" dir="rtl"><GlobalLoadingState title="טוענים את גן בטוח…" description="מכינים את המרחב שלך ושומרים על מבנה העמוד יציב." /></main>;
}
