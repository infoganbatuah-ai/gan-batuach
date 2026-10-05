import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { AlertTriangle, CheckCircle2, CircleSlash2, CloudOff, FileSearch, LockKeyhole, PlugZap, RefreshCcw, Settings2, WifiOff } from "lucide-react";
import { canonicalStatusDefinition, type CanonicalStatusTone } from "@/lib/ui/canonical-status";

export type GlobalStateKind = "loading" | "empty" | "error" | "permission" | "unavailable" | "offline" | "degraded" | "success";
type IconType = ComponentType<LucideProps>;

const icons: Record<GlobalStateKind, IconType> = { loading: RefreshCcw, empty: FileSearch, error: AlertTriangle, permission: LockKeyhole, unavailable: PlugZap, offline: WifiOff, degraded: CloudOff, success: CheckCircle2 };
const defaultCopy: Record<GlobalStateKind, { title: string; description: string }> = {
  loading: { title: "טוענים נתונים…", description: "אנחנו מכינים עבורך את המידע העדכני." },
  empty: { title: "עדיין אין נתונים להצגה", description: "כשיתווסף מידע מתאים, הוא יופיע כאן." },
  error: { title: "אירעה שגיאה", description: "לא הצלחנו להשלים את הבקשה. אפשר לנסות שוב בעוד רגע." },
  permission: { title: "אין לך הרשאה לצפות בעמוד הזה", description: "הגישה למידע מוגבלת לפי התפקיד וההקשר הפעיל שלך." },
  unavailable: { title: "השירות אינו זמין כרגע", description: "היכולת אינה מוגדרת או שהספק החיצוני אינו זמין." },
  offline: { title: "אין חיבור לאינטרנט", description: "בדקו את החיבור ונסו שוב. מידע שמור לא יוצג כמידע עדכני." },
  degraded: { title: "השירות פועל באופן חלקי", description: "חלק מהמידע עשוי להיות חסר או לא עדכני. אפשר לנסות שוב." },
  success: { title: "הפעולה הושלמה בהצלחה", description: "השינויים נשמרו במערכת." }
};

function cx(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(" "); }

export function StateAction({ href, children, secondary = false }: { href: string; children: ReactNode; secondary?: boolean }) {
  return <Link className={cx("button", secondary ? "secondary" : "primary")} href={href}>{children}</Link>;
}

export function GlobalStatePanel({ kind, title, description, action, secondaryAction, icon: IconOverride, compact = false, className, statusLabel }: { kind: GlobalStateKind; title?: ReactNode; description?: ReactNode; action?: ReactNode; secondaryAction?: ReactNode; icon?: IconType; compact?: boolean; className?: string; statusLabel?: string }) {
  const Icon = IconOverride ?? icons[kind];
  const copy = defaultCopy[kind];
  const isAlert = kind === "error" || kind === "permission";
  return (
    <section className={cx("ux19-global-state", `ux19-state-${kind}`, compact && "is-compact", className)} role={isAlert ? "alert" : "status"} aria-live={isAlert ? "assertive" : "polite"} aria-busy={kind === "loading" ? "true" : undefined} aria-label={statusLabel ?? copy.title}>
      <span className="ux19-state-orb" aria-hidden="true"><Icon size={compact ? 28 : 42} strokeWidth={2.25} /></span>
      <div className="ux19-state-copy"><h1>{title ?? copy.title}</h1><p>{description ?? copy.description}</p></div>
      {kind === "loading" ? <SkeletonBlocks compact={compact} /> : null}
      {action || secondaryAction ? <div className="ux19-state-actions">{action}{secondaryAction}</div> : null}
    </section>
  );
}

export function SkeletonBlocks({ lines = 3, compact = false }: { lines?: number; compact?: boolean }) {
  return <div className={cx("ux19-skeleton-stack", compact && "is-compact")} aria-hidden="true">{Array.from({ length: lines }, (_, index) => <i key={index} />)}</div>;
}

export function GlobalLoadingState({ title, description, compact = false }: { title?: ReactNode; description?: ReactNode; compact?: boolean }) { return <GlobalStatePanel kind="loading" title={title} description={description} compact={compact} />; }
export function GlobalEmptyState({ title, description, action, compact = false }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; compact?: boolean }) { return <GlobalStatePanel kind="empty" title={title} description={description} action={action} compact={compact} />; }

export function PermissionDeniedState({ backHref = "/dashboard", title, description }: { backHref?: string; title?: ReactNode; description?: ReactNode }) {
  return <GlobalStatePanel kind="permission" title={title} description={description} action={<StateAction href={backHref}>חזרה למרחב המורשה</StateAction>} />;
}

export function ProviderState({ state, action }: { state: "unavailable" | "not_configured" | "setup_required" | "production_verification_required" | "offline" | "degraded"; action?: ReactNode }) {
  const copy = {
    unavailable: ["השירות אינו זמין כרגע", "לא התקבל אישור זמינות מהספק."],
    not_configured: ["השירות טרם הוגדר", "נדרשת הגדרה קנונית לפני שניתן להשתמש ביכולת."],
    setup_required: ["נדרשת השלמת הגדרה", "יש להשלים את שלבי ההגדרה לפני ההפעלה."],
    production_verification_required: ["נדרש אימות Production", "היכולת לא תוצג כפעילה לפני אימות סביבת הייצור."],
    offline: ["השירות אינו מחובר", "לא התקבל חיבור עדכני. אפשר לבדוק שוב בלי להסתיר את המצב."],
    degraded: ["השירות פועל באופן חלקי", "חלק מהפעולות זמינות וחלקן דורשות בדיקה נוספת."]
  } as const;
  const kind: GlobalStateKind = state === "offline" ? "offline" : state === "degraded" ? "degraded" : "unavailable";
  return <GlobalStatePanel kind={kind} title={copy[state][0]} description={copy[state][1]} action={action} icon={state === "setup_required" ? Settings2 : state === "not_configured" ? CircleSlash2 : undefined} />;
}

export function GlobalSuccessState({ title, description, action }: { title?: ReactNode; description?: ReactNode; action?: ReactNode }) { return <GlobalStatePanel kind="success" title={title} description={description} action={action} />; }

export function CanonicalStatus({ status, label, tone }: { status: string; label?: ReactNode; tone?: CanonicalStatusTone }) {
  const definition = canonicalStatusDefinition(status);
  return <span className={cx("ux19-status", `ux19-tone-${tone ?? definition.tone}`)} role="status"><i aria-hidden="true" />{label ?? definition.label}</span>;
}
