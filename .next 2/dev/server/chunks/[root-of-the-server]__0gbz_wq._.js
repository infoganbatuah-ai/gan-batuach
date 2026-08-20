module.exports = [
"[externals]/next/dist/build/adapter/setup-node-env.external.js [external] (next/dist/build/adapter/setup-node-env.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/build/adapter/setup-node-env.external.js", () => require("next/dist/build/adapter/setup-node-env.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/lib/incremental-cache/tags-manifest.external.js [external] (next/dist/server/lib/incremental-cache/tags-manifest.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/lib/incremental-cache/tags-manifest.external.js", () => require("next/dist/server/lib/incremental-cache/tags-manifest.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[externals]/next/dist/server/lib/incremental-cache/memory-cache.external.js [external] (next/dist/server/lib/incremental-cache/memory-cache.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/lib/incremental-cache/memory-cache.external.js", () => require("next/dist/server/lib/incremental-cache/memory-cache.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/lib/incremental-cache/shared-cache-controls.external.js [external] (next/dist/server/lib/incremental-cache/shared-cache-controls.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/lib/incremental-cache/shared-cache-controls.external.js", () => require("next/dist/server/lib/incremental-cache/shared-cache-controls.external.js"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/lib/supabase/middleware.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "updateSession",
    ()=>updateSession
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createServerClient.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [middleware] (ecmascript)");
;
;
async function updateSession(request) {
    let response = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next({
        request
    });
    const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createServerClient"])(("TURBOPACK compile-time value", "https://kuaywzvucllxjsxarogb.supabase.co"), ("TURBOPACK compile-time value", "sb_publishable_HwVUB2pU_ry7ZdTmHzXYYw_6OJV5Sv1"), {
        cookies: {
            getAll () {
                return request.cookies.getAll();
            },
            setAll (cookiesToSet) {
                cookiesToSet.forEach(({ name, value })=>request.cookies.set(name, value));
                response = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next({
                    request
                });
                cookiesToSet.forEach(({ name, value, options })=>response.cookies.set(name, value, options));
            }
        }
    });
    const authResult = await supabase.auth.getUser();
    if (("TURBOPACK compile-time value", "development") !== "production" && authResult.error) {
        console.info("Session refresh completed without an authenticated user.", {
            route: request.nextUrl.pathname,
            code: authResult.error.code ?? "auth_session_missing"
        });
    }
    return response;
}
}),
"[project]/proxy.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "proxy",
    ()=>proxy
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$middleware$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase/middleware.ts [middleware] (ecmascript)");
;
;
function firstForwardedIp(value) {
    return value?.split(",")[0]?.trim() || null;
}
function envHosts(...values) {
    return values.flatMap((value)=>value?.split(",") ?? []).map((value)=>value.trim().toLowerCase()).filter(Boolean);
}
function hostWithoutPort(value) {
    return value?.split(":")[0]?.toLowerCase() ?? "";
}
function isDigitalObserverHost(request) {
    if (process.env.DIGITAL_OBSERVER_CUSTOM_DOMAIN_ENABLED !== "true") return false;
    const host = hostWithoutPort(request.headers.get("host"));
    if (!host) return false;
    return envHosts(process.env.DIGITAL_OBSERVER_PUBLIC_HOST, process.env.DIGITAL_OBSERVER_APP_HOST).includes(host);
}
function digitalObserverRewritePath(pathname) {
    if (pathname.startsWith("/digital-observer")) return null;
    if (pathname.startsWith("/api") || pathname.startsWith("/auth")) return null;
    if (pathname === "/") return "/digital-observer";
    if (pathname === "/dashboard") return "/digital-observer/dashboard";
    if (pathname === "/onboarding") return "/digital-observer/onboarding";
    if (pathname.startsWith("/sites/")) return `/digital-observer${pathname}`;
    return `/digital-observer${pathname}`;
}
function rewriteForDigitalObserverHost(request, response) {
    if (!isDigitalObserverHost(request)) return response;
    const nextPath = digitalObserverRewritePath(request.nextUrl.pathname);
    if (!nextPath) return response;
    const url = request.nextUrl.clone();
    url.pathname = nextPath;
    const rewrite = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].rewrite(url, {
        request
    });
    response.headers.forEach((value, key)=>rewrite.headers.set(key, value));
    response.cookies.getAll().forEach((cookie)=>rewrite.cookies.set(cookie));
    rewrite.headers.set("x-digital-observer-host-routing", "ready");
    return rewrite;
}
function writeAuditLog(request, responseStatus, requestId) {
    const supabaseUrl = ("TURBOPACK compile-time value", "https://kuaywzvucllxjsxarogb.supabase.co");
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) return Promise.resolve();
    const endpoint = `${supabaseUrl}/rest/v1/audit_logs`;
    const role = request.cookies.get("gb_role")?.value ?? request.headers.get("x-user-role") ?? null;
    return fetch(endpoint, {
        method: "POST",
        headers: {
            apikey: serviceRoleKey,
            authorization: `Bearer ${serviceRoleKey}`,
            "content-type": "application/json",
            prefer: "return=minimal"
        },
        body: JSON.stringify({
            entity_type: "http_request",
            action: "request_observed",
            user_role: role,
            http_method: request.method,
            api_endpoint: request.nextUrl.pathname,
            client_source_ip: firstForwardedIp(request.headers.get("x-forwarded-for")),
            http_status_code: responseStatus,
            request_id: requestId,
            ip: firstForwardedIp(request.headers.get("x-forwarded-for")),
            user_agent: request.headers.get("user-agent"),
            compliance_context: {
                source: "next_proxy",
                iso_27001: true,
                iso_27017: true,
                iso_27701: true
            }
        })
    }).then(()=>undefined).catch(()=>undefined);
}
async function proxy(request, event) {
    const requestId = crypto.randomUUID();
    const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$middleware$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["updateSession"])(request);
    const routedResponse = rewriteForDigitalObserverHost(request, response);
    routedResponse.headers.set("x-request-id", requestId);
    event.waitUntil(writeAuditLog(request, routedResponse.status, requestId));
    return routedResponse;
}
const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
    ]
};
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0gbz_wq._.js.map