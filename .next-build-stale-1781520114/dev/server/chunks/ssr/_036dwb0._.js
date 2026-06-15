module.exports = [
"[project]/lib/supabase/server.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createClient",
    ()=>createClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createServerClient.js [app-rsc] (ecmascript)");
;
;
async function createClient() {
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createServerClient"])(("TURBOPACK compile-time value", "https://kuaywzvucllxjsxarogb.supabase.co"), ("TURBOPACK compile-time value", "sb_publishable_HwVUB2pU_ry7ZdTmHzXYYw_6OJV5Sv1"), {
        cookies: {
            getAll () {
                return cookieStore.getAll();
            },
            setAll (cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options })=>cookieStore.set(name, value, options));
                } catch  {
                // Server Components cannot always set cookies; middleware refreshes sessions.
                }
            }
        }
    });
}
}),
"[project]/lib/roles.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "hasPermission",
    ()=>hasPermission,
    "isRole",
    ()=>isRole,
    "rolePermissions",
    ()=>rolePermissions,
    "roles",
    ()=>roles
]);
const roles = [
    "admin",
    "inspector",
    "manager",
    "owner",
    "staff",
    "parent"
];
const rolePermissions = {
    admin: [
        "gardens:read",
        "gardens:write",
        "children:read",
        "children:write",
        "staff:read",
        "staff:write",
        "inspections:read",
        "inspections:write",
        "inspection_forms:write",
        "violations:write",
        "tasks:write",
        "messages:write",
        "complaints:write",
        "child_journal:read",
        "child_journal:write",
        "medical_data:read",
        "medical_data:write",
        "documents:read",
        "documents:write",
        "documents:approve",
        "documents:download",
        "attendance:write",
        "cameras:read",
        "cameras:write",
        "video:stream",
        "ai_events:read",
        "ai_events:write",
        "billing:read",
        "billing:write",
        "audit_logs:read"
    ],
    inspector: [
        "gardens:read",
        "children:read",
        "staff:read",
        "inspections:read",
        "inspections:write",
        "violations:write",
        "tasks:write",
        "messages:write",
        "complaints:write",
        "child_journal:read",
        "medical_data:read",
        "documents:read",
        "documents:write",
        "documents:approve",
        "documents:download",
        "cameras:read",
        "video:stream",
        "ai_events:read",
        "billing:read",
        "billing:write"
    ],
    manager: [
        "gardens:read",
        "gardens:write",
        "children:read",
        "children:write",
        "staff:read",
        "staff:write",
        "inspections:read",
        "tasks:write",
        "messages:write",
        "complaints:write",
        "child_journal:read",
        "child_journal:write",
        "medical_data:read",
        "medical_data:write",
        "documents:read",
        "documents:write",
        "documents:approve",
        "documents:download",
        "attendance:write",
        "cameras:read",
        "cameras:write",
        "video:stream",
        "ai_events:read",
        "billing:read",
        "billing:write"
    ],
    owner: [
        "gardens:read",
        "gardens:write",
        "children:read",
        "children:write",
        "staff:read",
        "staff:write",
        "inspections:read",
        "tasks:write",
        "messages:write",
        "complaints:write",
        "child_journal:read",
        "child_journal:write",
        "medical_data:read",
        "medical_data:write",
        "documents:read",
        "documents:write",
        "documents:approve",
        "documents:download",
        "attendance:write",
        "cameras:read",
        "cameras:write",
        "video:stream",
        "ai_events:read"
    ],
    staff: [
        "gardens:read",
        "children:read",
        "messages:write",
        "attendance:write",
        "tasks:write",
        "child_journal:read",
        "child_journal:write",
        "medical_data:read",
        "documents:read",
        "documents:write",
        "cameras:read",
        "video:stream"
    ],
    parent: [
        "children:read",
        "children:write",
        "messages:write",
        "complaints:write",
        "attendance:write",
        "cameras:read",
        "video:stream",
        "ai_events:read",
        "child_journal:read",
        "medical_data:read",
        "documents:read",
        "documents:download"
    ]
};
function hasPermission(role, permission) {
    if (!role) return false;
    return rolePermissions[role]?.includes(permission) ?? false;
}
function isRole(value) {
    return typeof value === "string" && roles.includes(value);
}
}),
"[project]/lib/auth.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "dashboardPathForRole",
    ()=>dashboardPathForRole,
    "getSessionProfile",
    ()=>getSessionProfile,
    "requirePermission",
    ()=>requirePermission,
    "requireRole",
    ()=>requireRole,
    "requireUser",
    ()=>requireUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase/server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$roles$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/roles.ts [app-rsc] (ecmascript)");
;
;
;
async function getSessionProfile() {
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {
        user: null,
        profile: null
    };
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    return {
        user,
        profile
    };
}
async function requireUser() {
    const session = await getSessionProfile();
    if (!session.user || !session.profile) (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])("/login");
    return {
        user: session.user,
        profile: session.profile
    };
}
async function requireRole(allowed) {
    const session = await requireUser();
    const role = session.profile.role;
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$roles$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isRole"])(role) || !allowed.includes(role)) (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])("/dashboard");
    return session;
}
async function requirePermission(permission) {
    const session = await requireUser();
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$roles$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hasPermission"])(session.profile.role, permission)) {
        return {
            allowed: false,
            session
        };
    }
    return {
        allowed: true,
        session
    };
}
function dashboardPathForRole(role) {
    return ({
        admin: "/dashboard/admin",
        inspector: "/dashboard/inspector",
        manager: "/dashboard/garden",
        owner: "/dashboard/garden",
        staff: "/dashboard/staff",
        parent: "/dashboard/parent"
    })[role];
}
}),
"[project]/app/login/actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"00ac59b28f09007e9880b87b7d9df6cab0aa1d0162":{"name":"signOut"},"405a407de3d5e9d4808704c972dfc23180e1cba898":{"name":"signIn"}},"app/login/actions.ts",""] */ __turbopack_context__.s([
    "signIn",
    ()=>signIn,
    "signOut",
    ()=>signOut
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase/server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/auth.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$roles$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/roles.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
async function signIn(formData) {
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const gardenId = String(formData.get("context_garden_id") || "");
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
    const { error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    if (error) (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])(`/login?error=${encodeURIComponent(error.message)}`);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
    const role = profile?.role;
    const path = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$roles$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isRole"])(role) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["dashboardPathForRole"])(role) : "/dashboard";
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])(gardenId ? `${path}?gardenId=${encodeURIComponent(gardenId)}` : path);
}
async function signOut() {
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
    await supabase.auth.signOut();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])("/login");
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    signIn,
    signOut
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(signIn, "405a407de3d5e9d4808704c972dfc23180e1cba898", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(signOut, "00ac59b28f09007e9880b87b7d9df6cab0aa1d0162", null);
}),
"[project]/.next-internal/server/app/login/page/actions.js { ACTIONS_MODULE0 => \"[project]/app/login/actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/login/actions.ts [app-rsc] (ecmascript)");
;
;
}),
"[project]/.next-internal/server/app/login/page/actions.js { ACTIONS_MODULE0 => \"[project]/app/login/actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "00ac59b28f09007e9880b87b7d9df6cab0aa1d0162",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signOut"],
    "405a407de3d5e9d4808704c972dfc23180e1cba898",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signIn"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$login$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/login/page/actions.js { ACTIONS_MODULE0 => "[project]/app/login/actions.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/login/actions.ts [app-rsc] (ecmascript)");
}),
];

//# sourceMappingURL=_036dwb0._.js.map