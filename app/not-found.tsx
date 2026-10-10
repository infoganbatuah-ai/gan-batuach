import { GlobalEmptyState, StateAction } from "@/components/global-state-system";

export default function NotFound() {
  return (
    <main className="dashboard-safe-state" dir="rtl">
      <GlobalEmptyState title="העמוד לא נמצא" description="ייתכן שהקישור השתנה או שהעמוד אינו זמין בהקשר הנוכחי." action={<StateAction href="/dashboard">חזרה לדף הבית</StateAction>} />
    </main>
  );
}
