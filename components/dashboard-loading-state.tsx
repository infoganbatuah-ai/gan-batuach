import { GlobalLoadingState } from "@/components/global-state-system";

export function DashboardLoadingState({ title = "טוען נתונים", body = "אנחנו מכינים את הדשבורד בצורה בטוחה. זה יכול לקחת רגע אם יש הרבה נתונים." }: { title?: string; body?: string }) {
  return <main className="dashboard-safe-state" dir="rtl"><GlobalLoadingState title={title} description={body} /></main>;
}
