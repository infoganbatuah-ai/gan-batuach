export const dynamic = "force-dynamic";

export function GET() {
  if (process.env.NODE_ENV !== "development" || process.env.INTEGRATION_DEVELOPMENT !== "true") {
    return new Response(null, { status: 404 });
  }
  return Response.json({
    environment: process.env.GB_FEATURE_QA === "true" ? "FEATURE QA / NOT CANONICAL PRODUCT" : "DEVELOPMENT / INTEGRATION",
    commit: process.env.INTEGRATION_COMMIT,
    startedAt: process.env.INTEGRATION_STARTED_AT,
    backend: process.env.INTEGRATION_BACKEND,
    production: false,
    ...(process.env.GB_FEATURE_QA === "true" ? { canonicalProduct: false } : {}),
  }, { headers: { "Cache-Control": "no-store" } });
}
