import Image from "next/image";
import Link from "next/link";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { BadgeCheck, BriefcaseBusiness, Building2, CalendarDays, ChevronLeft, CircleAlert, FileCheck2, MapPin, Sparkles, UsersRound } from "lucide-react";
import type { LucideProps } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { recruitmentApplicationState, recruitmentMatchReason, recruitmentTimelineSteps } from "@/lib/domain/recruitment-display";

export function RecruitmentHero({ title, text, eyebrow, action, compact = false }: { title: string; text: string; eyebrow?: string; action?: ReactNode; compact?: boolean }) {
  return <section className={`ux08-recruitment-hero ${compact ? "compact" : ""}`}>
    <Image className="ux08-recruitment-hero-image" src="/assets/ux08-recruitment-hero.webp" alt="מחנכת וילדים בפעילות בגן" fill sizes="(max-width: 820px) 100vw, 520px" priority={!compact} />
    <div className="ux08-recruitment-hero-copy">
      <span><Sparkles size={16} /> {eyebrow ?? "קריירה עם משמעות"}</span>
      <h1>{title}</h1><p>{text}</p>{action ? <div className="ux08-hero-actions">{action}</div> : null}
    </div>
  </section>;
}

export function RecruitmentMetric({ icon: Icon, value, label, tone = "blue" }: { icon: ComponentType<LucideProps>; value: ReactNode; label: string; tone?: "blue" | "green" | "purple" | "orange" }) {
  return <article className={`ux08-metric ${tone}`}><span><Icon /></span><strong>{value}</strong><small>{label}</small></article>;
}

export function CandidateIdentity({ name, role, city, photo, status }: { name: string; role?: string | null; city?: string | null; photo?: string | null; status?: string | null }) {
  return <section className="ux08-candidate-identity">
    <Avatar name={name} src={photo} size="lg" />
    <div><span className="ux08-eyebrow">פרופיל מקצועי</span><h1>{name}</h1><p>{role || "מועמדות לצוות גן"}{city ? ` · ${city}` : ""}</p><StatusChip tone={status === "active" ? "success" : "warning"}>{status === "active" ? "מועמדות פעילה" : "בהשלמת פרופיל"}</StatusChip></div>
  </section>;
}

export function CompletenessRing({ percentage }: { percentage: number }) {
  const safe = Math.max(0, Math.min(100, Number(percentage || 0)));
  return <div className="ux08-completeness-ring" style={{ "--ux08-progress": `${safe * 3.6}deg` } as CSSProperties}><span><strong>{safe}%</strong><small>שלמות</small></span></div>;
}

export function RecruitmentTabs({ active }: { active: "home" | "profile" | "jobs" | "applications" | "documents" }) {
  const items = [
    ["home", "ראשי", "/dashboard/staff/job-market"],
    ["profile", "פרופיל", "/dashboard/staff/settings"],
    ["jobs", "משרות", "/dashboard/staff/job-market#opportunities"],
    ["applications", "מועמדויות", "/dashboard/staff/job-market#applications"],
    ["documents", "מסמכים", "/dashboard/staff/documents"]
  ] as const;
  return <nav className="ux08-tabs" aria-label="אזור מועמדות">{items.map(([key, label, href]) => <Link className={active === key ? "active" : ""} href={href} key={key}>{label}</Link>)}</nav>;
}

type JobCardProps = {
  id: string; gardenName: string; city?: string | null; role: string; ageGroup?: string | null; employmentType?: string | null;
  matchLevel?: string | null; reasons?: string[] | null; applicationStatus?: string | null; actions?: ReactNode;
};

export function RecruitmentJobCard(props: JobCardProps) {
  const exact = props.matchLevel === "exact_match";
  return <article className="ux08-job-card">
    <div className="ux08-job-card-art"><Building2 /><span>{props.gardenName.slice(0, 1)}</span></div>
    <div className="ux08-job-card-body">
      <header><div><small>{props.gardenName}</small><h3>{props.role}</h3></div><StatusChip tone={exact ? "success" : "info"}>{exact ? "התאמה מלאה" : "משרה רלוונטית"}</StatusChip></header>
      <div className="ux08-job-facts"><span><MapPin /> {props.city || "מיקום לא פורסם"}</span><span><UsersRound /> {props.ageGroup || "כל קבוצות הגיל"}</span><span><CalendarDays /> {props.employmentType || "פרטי העסקה בראיון"}</span></div>
      <div className="ux08-match-reasons">{(props.reasons ?? []).slice(0, 3).map((reason) => <span key={reason}><BadgeCheck /> {recruitmentMatchReason(reason)}</span>)}</div>
      <div className="ux08-job-actions"><Link className="button secondary" href={`/dashboard/staff/job-market/${props.id}`}>פרטי המשרה <ChevronLeft /></Link>{props.actions}</div>
    </div>
  </article>;
}

export function ApplicationTimeline({ status }: { status: string }) {
  const state = recruitmentApplicationState(status);
  return <ol className="ux08-application-timeline" aria-label={`מצב מועמדות: ${state.label}`}>{recruitmentTimelineSteps.map((label, index) => <li className={index + 1 <= state.step ? "done" : index + 1 === state.step + 1 ? "current" : ""} key={label}><span>{index + 1}</span><b>{label}</b></li>)}</ol>;
}

export function ApplicationCard({ id, garden, role, status, submittedAt, informationRequest }: { id: string; garden: string; role: string; status: string; submittedAt?: string | null; informationRequest?: string | null }) {
  const state = recruitmentApplicationState(status);
  return <article className={`ux08-application-card state-${state.tone}`}>
    <header><div><span className="ux08-card-icon"><BriefcaseBusiness /></span><div><h3>{role}</h3><p>{garden}</p></div></div><StatusChip tone={state.tone}>{state.label}</StatusChip></header>
    <ApplicationTimeline status={status} />
    {informationRequest ? <p className="ux08-info-required"><CircleAlert /> {informationRequest}</p> : null}
    <footer><span>{submittedAt ? `הוגשה ${new Date(submittedAt).toLocaleDateString("he-IL")}` : "ממתינה לעדכון"}</span><Link href={`/dashboard/staff/job-market/applications/${id}`}>פתיחת המועמדות <ChevronLeft /></Link></footer>
  </article>;
}

export function CandidateRow({ id, name, role, city, status, completeness, documentStatus, photo }: { id: string; name: string; role: string; city?: string | null; status: string; completeness: number; documentStatus: string; photo?: string | null }) {
  const state = recruitmentApplicationState(status);
  return <Link className="ux08-candidate-row" href={`/dashboard/garden/staff-applications/${id}`}>
    <Avatar name={name} src={photo} />
    <span className="ux08-candidate-name"><strong>{name}</strong><small>{role} · {city || "מיקום לא צוין"}</small></span>
    <span className="ux08-candidate-completeness"><b>{completeness}%</b><i><em style={{ width: `${Math.max(0, Math.min(completeness, 100))}%` }} /></i></span>
    <StatusChip tone={documentStatus === "verified" ? "success" : "warning"}><FileCheck2 /> {documentStatus === "verified" ? "מסמכים אומתו" : "מסמכים לבדיקה"}</StatusChip>
    <StatusChip tone={state.tone}>{state.label}</StatusChip><ChevronLeft />
  </Link>;
}
