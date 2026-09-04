import { z } from "zod";
import type { GuardDiagnosticRequest, GuardDiagnosticView } from "./guard-diagnostics-types";

// Browser-safe response boundary. Do not import the server queue/crypto module.
const viewSchema = z.object({
  request_id: z.string().uuid(), camera_source_id: z.string().uuid(),
  task_kind: z.enum(["capability_snapshot", "command_preflight"]),
  state: z.enum(["queued", "running", "completed", "failed", "expired", "blocked", "cancelled"]),
  expires_at: z.string().datetime({ offset: true }), audit_recorded: z.literal(true),
  executed: z.literal(false), executor_installed: z.literal(false), requires_immediate_confirmation: z.literal(true),
  capabilities: z.object({ ptz: z.boolean(), twoWayAudio: z.boolean(), siren: z.boolean(), lighting: z.boolean() }).strict().optional(),
  action: z.enum(["ptz", "talk", "siren", "lighting"]).optional(), supported: z.boolean().optional(),
  evidence_id: z.string().uuid().optional(), verified_at: z.string().datetime({ offset: true }).nullable().optional()
}).strict();
const pending = (view: GuardDiagnosticView) => view.state === "queued" || view.state === "running";
export function expireGuardDiagnostic(view: GuardDiagnosticView, now = Date.now()): GuardDiagnosticView {
  if (Date.parse(view.expires_at) > now || !["queued", "running", "completed"].includes(view.state)) return view;
  const { capabilities, action, supported, evidence_id, verified_at, ...base } = view;
  void capabilities; void action; void supported; void evidence_id; void verified_at;
  return { ...base, state: "expired" };
}

function parseView(value: unknown, input: GuardDiagnosticRequest, now: number, expiresAt?: string): GuardDiagnosticView {
  const view = viewSchema.parse(value);
  if (view.request_id !== input.request_id || view.camera_source_id !== input.camera_source_id || view.task_kind !== input.task_kind
    || Date.parse(view.expires_at) > now + 125_000 || (expiresAt && view.expires_at !== expiresAt)) throw Error("DIAGNOSTIC_RESPONSE_INVALID");
  if (view.state === "completed") {
    if (!view.evidence_id || view.verified_at === undefined) throw Error("DIAGNOSTIC_RESPONSE_INVALID");
    if (view.verified_at && (Date.parse(view.verified_at) > now + 5_000 || now - Date.parse(view.verified_at) > 120_000
      || Date.parse(view.verified_at) > Date.parse(view.expires_at))) throw Error("DIAGNOSTIC_RESPONSE_INVALID");
    if (input.task_kind === "capability_snapshot") {
      if (!view.capabilities || view.action !== undefined || view.supported !== undefined
        || (!view.verified_at && Object.values(view.capabilities).some(Boolean))) throw Error("DIAGNOSTIC_RESPONSE_INVALID");
    } else if (view.action !== input.action || typeof view.supported !== "boolean" || view.capabilities !== undefined
      || (view.supported && !view.verified_at)) throw Error("DIAGNOSTIC_RESPONSE_INVALID");
  } else if (view.capabilities !== undefined || view.action !== undefined || view.supported !== undefined || view.evidence_id !== undefined || view.verified_at !== undefined) {
    throw Error("DIAGNOSTIC_RESPONSE_INVALID");
  }
  return expireGuardDiagnostic(view, now);
}

export function diagnosticWait(milliseconds: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Exactly one audited intent; polling only reads status, never creates a retry job. */
export async function runGuardDiagnostic(input: GuardDiagnosticRequest, options: {
  signal: AbortSignal; token?: string | null; onUpdate?: (view: GuardDiagnosticView) => void;
  fetcher?: typeof fetch; now?: () => number; wait?: typeof diagnosticWait;
}): Promise<GuardDiagnosticView> {
  const now = options.now ?? Date.now, fetcher = options.fetcher ?? fetch, wait = options.wait ?? diagnosticWait;
  const started = now();
  const scope = new URLSearchParams({ observer_site_id: input.observer_site_id, camera_source_id: input.camera_source_id, request_id: input.request_id });
  const request = async (write: boolean, expiresAt?: string) => {
    options.signal.throwIfAborted();
    const response = await fetcher(`/api/digital-observer/camera-diagnostics${write ? "" : `?${scope}`}`, {
      method: write ? "POST" : "GET", credentials: "same-origin", redirect: "error", cache: "no-store",
      signal: AbortSignal.any([options.signal, AbortSignal.timeout(10_000)]),
      headers: { ...(write ? { "Content-Type": "application/json" } : {}), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
      ...(write ? { body: JSON.stringify(input) } : {})
    });
    if (!response.ok) throw Error(response.status === 401 ? "DIAGNOSTIC_LOGIN_REQUIRED" : response.status === 403 ? "DIAGNOSTIC_FORBIDDEN" : "DIAGNOSTIC_REQUEST_FAILED");
    const payload = await response.json();
    options.signal.throwIfAborted();
    return parseView(payload?.data?.diagnostic, input, now(), expiresAt);
  };
  let view = await request(true);
  const expiresAt = view.expires_at;
  options.onUpdate?.(view);
  for (let count = 0; pending(view) && count < 60; count++) {
    const remaining = Math.min(Date.parse(expiresAt), started + 120_000) - now();
    if (remaining <= 0) break;
    await wait(Math.min(2_000, remaining), options.signal);
    if (now() >= Date.parse(expiresAt) || now() >= started + 120_000) break;
    view = await request(false, expiresAt);
    options.onUpdate?.(view);
  }
  view = expireGuardDiagnostic(view, now());
  if (pending(view)) throw Error("DIAGNOSTIC_WAIT_EXHAUSTED");
  options.onUpdate?.(view);
  return view;
}
