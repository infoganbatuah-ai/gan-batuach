export function DevelopmentIdentity() {
  if (process.env.NODE_ENV !== "development" || process.env.INTEGRATION_DEVELOPMENT !== "true") return null;
  const backend = process.env.INTEGRATION_BACKEND === "UNAVAILABLE_UI_ONLY"
    ? "UI בלבד · backend לא זמין"
    : "backend מקומי";
  const identity = `Development / Integration · ${process.env.INTEGRATION_COMMIT?.slice(0, 12) ?? "local"} · ${backend} · לא Production`;
  return (
    <aside className="development-identity" dir="rtl" aria-label={identity} title={`${identity} · ${process.env.INTEGRATION_STARTED_AT ?? ""}`}>
      <strong>DEV</strong>
      <span>{identity}</span>
    </aside>
  );
}
