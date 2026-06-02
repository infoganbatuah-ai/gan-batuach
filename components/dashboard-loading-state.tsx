export function DashboardLoadingState({ title = "טוען נתונים", body = "אנחנו מכינים את הדשבורד בצורה בטוחה. זה יכול לקחת רגע אם יש הרבה נתונים." }: { title?: string; body?: string }) {
  return (
    <main className="dashboard-safe-state" dir="rtl">
      <div className="safe-state-card">
        <span className="loader-ring" aria-hidden="true" />
        <div>
          <p className="eyebrow">Gan Batuach</p>
          <h1>{title}</h1>
          <p>{body}</p>
        </div>
        <div className="skeleton-stack" aria-hidden="true"><i /><i /><i /></div>
      </div>
    </main>
  );
}
