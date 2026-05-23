import { Camera, ClipboardCheck, FileUp, ListChecks, Scale, ShieldAlert, ToggleLeft, Type } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

const categories = ["licensing and documents", "child safety", "building safety", "yard safety", "staff-child ratio", "staff background checks", "first aid", "emergency readiness", "kitchen and food", "hygiene", "medical information", "authorized pickup", "parent communication", "privacy and data protection", "cameras and video access", "AI observer readiness", "complaint handling", "daily schedule and education", "incident documentation"];
const types = [{ icon: Scale, label: "score 1-10" }, { icon: ToggleLeft, label: "boolean" }, { icon: Type, label: "text" }, { icon: Camera, label: "photo upload" }, { icon: FileUp, label: "document upload" }];

export default async function InspectionFormsBuilderPage() {
  await requireRole(["admin"]);
  return (
    <DashboardShell role="admin" title="ניהול טפסי פיקוח">
      <div className="dashboard-hero-card"><div><p className="eyebrow">Inspection Builder</p><h1>בונה טפסי פיקוח דינמי לפי מבנה תפעול ורגולציה.</h1><p>קטגוריות, שאלות, משקלים, שדות חובה, critical flag, קבצים ותמונות.</p></div><span className="pill good"><ClipboardCheck size={15} /> מנוע ניקוד מחובר</span></div>
      <section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2>סוגי שאלות</h2><div className="quick-actions-grid small-actions">{types.map((type) => <div className="quick-action" key={type.label}><type.icon /><strong>{type.label}</strong><span>required · weight · critical</span></div>)}</div></article><article className="card action-panel"><h2>תוצאת ביקורת</h2><div className="risk-list"><div><Scale /> ממוצע משוקלל <b>1-10</b></div><div><ShieldAlert /> ציון 1-4 <b>יוצר ליקוי</b></div><div><ListChecks /> משימת תיקון <b>אוטומטית</b></div><div><ClipboardCheck /> GPS <b>חובה לפני Submit</b></div></div></article></section>
      <section className="dashboard-section"><div className="section-heading"><h2>קטגוריות ברירת מחדל</h2><p>מבנה שמכסה בטיחות, כוח אדם, פרטיות, מצלמות, תברואה, חירום ושקיפות להורים.</p></div><div className="tag-cloud">{categories.map((category) => <span key={category}>{category}</span>)}</div></section>
    </DashboardShell>
  );
}
