export function DevelopmentIdentity() {
  if (process.env.NODE_ENV !== "development" || process.env.INTEGRATION_DEVELOPMENT !== "true") return null;
  return (
    <aside dir="ltr" aria-label="Development build identity" style={{position:"sticky",top:0,zIndex:10000,background:"#fff3cd",color:"#332701",padding:"8px 16px",textAlign:"center",fontSize:13}}>
      DEVELOPMENT / INTEGRATION · {process.env.INTEGRATION_COMMIT?.slice(0,12)} · {process.env.INTEGRATION_STARTED_AT}
      {process.env.INTEGRATION_BACKEND === "UNAVAILABLE_UI_ONLY" ? " · UI ONLY — backend unavailable; not Production" : " · local backend — not Production"}
    </aside>
  );
}
