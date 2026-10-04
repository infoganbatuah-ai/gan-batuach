"use client";

import { useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileImage,
  FileText,
  FileUp,
  Filter,
  Folder,
  FolderOpen,
  History,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
  X
} from "lucide-react";
import { uploadManagementDocument } from "@/lib/client-upload";
import { DocumentReviewActions } from "@/components/document-review-actions";

export type DocumentsPlatformRow = {
  id: string;
  garden_id: string;
  name: string | null;
  document_type: string | null;
  owner_type?: string | null;
  owner_profile_id?: string | null;
  staff_id?: string | null;
  child_id?: string | null;
  inspection_id?: string | null;
  uploaded_by?: string | null;
  status: string | null;
  effective_status?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  mime_type?: string | null;
  byte_size?: number | null;
  replaces_document_id?: string | null;
  replaced_by?: string | null;
  file_url?: string | null;
  context_name?: string | null;
  garden_name?: string | null;
  can_review?: boolean;
};

export type DocumentsUploadTarget = {
  id: string;
  label: string;
  gardenId: string;
  ownerId?: string | null;
  documentTypes: string[];
};

const typeLabels: Record<string, string> = {
  garden_document: "מסמך גן",
  safety_certificate: "אישור בטיחות",
  health_certificate: "אישור תברואה",
  insurance: "ביטוח",
  camera_approval: "אישור מצלמות",
  regulatory: "מסמך רגולטורי",
  staff_document: "מסמך עובד",
  qualification: "הסמכה מקצועית",
  training: "הכשרה",
  first_aid: "עזרה ראשונה",
  police_clearance: "אישור יושר",
  background_check: "בדיקת רקע",
  teacher_certificate: "תעודת הוראה",
  owner_document: "מסמך בעלים",
  child_document: "מסמך ילד",
  medical_approval: "אישור רפואי",
  guardian_document: "מסמך הורה / אפוטרופוס",
  inspection_document: "מסמך ביקורת"
};

const statusLabels: Record<string, string> = {
  missing: "חסר",
  required: "נדרש",
  pending: "ממתין לבדיקה",
  pending_review: "ממתין לבדיקה",
  review: "ממתין לבדיקה",
  uploaded: "הועלה",
  approved: "מאושר",
  valid: "מאומת",
  rejected: "נדחה",
  expired: "פג תוקף",
  expiring_soon: "עומד לפוג",
  replaced: "הוחלף",
  replacement_required: "נדרשת החלפה",
  unavailable: "לא זמין",
  archived: "בארכיון"
};

function normalizedStatus(row: DocumentsPlatformRow) {
  return String(row.effective_status || row.status || "pending_review");
}

function statusTone(status: string) {
  if (["valid", "approved", "signed"].includes(status)) return "good";
  if (["expired", "rejected", "missing", "required", "replacement_required"].includes(status)) return "bad";
  if (["expiring_soon", "pending", "pending_review", "review", "uploaded"].includes(status)) return "warn";
  return "muted";
}

function categoryKey(row: DocumentsPlatformRow) {
  const owner = row.owner_type || "garden";
  if (owner === "child") return "children";
  if (owner === "guardian") return "parents";
  if (["staff", "teacher"].includes(owner)) return "staff";
  if (owner === "inspection") return "inspection";
  return "garden";
}

const categoryLabels: Record<string, string> = {
  all: "הכל",
  garden: "מסמכי גן",
  children: "ילדים",
  parents: "הורים",
  staff: "צוות",
  inspection: "פיקוח"
};

function dateText(value?: string | null) {
  if (!value) return "לא הוגדר";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "לא הוגדר" : date.toLocaleDateString("he-IL");
}

function sizeText(bytes?: number | null) {
  if (!bytes) return "גודל לא זמין";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(row: DocumentsPlatformRow) {
  return row.mime_type?.startsWith("image/") ? FileImage : FileText;
}

function replacementOwnerId(row: DocumentsPlatformRow) {
  if (row.owner_type === "staff") return row.staff_id;
  if (row.owner_type === "child") return row.child_id;
  if (row.owner_type === "inspection") return row.inspection_id;
  if (["owner", "teacher", "guardian"].includes(String(row.owner_type))) return row.owner_profile_id;
  return null;
}

function isActionRequired(status: string) {
  return ["missing", "required", "rejected", "expired", "replacement_required", "expiring_soon"].includes(status);
}

export function DocumentsPlatform({
  title,
  subtitle,
  rows: initialRows,
  uploadTargets = [],
  canReview = false,
  limitedMessage,
  roleLabel,
  initialSelectedId
}: {
  title: string;
  subtitle: string;
  rows: DocumentsPlatformRow[];
  uploadTargets?: DocumentsUploadTarget[];
  canReview?: boolean;
  limitedMessage?: string;
  roleLabel: string;
  initialSelectedId?: string | null;
}) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTargetId, setUploadTargetId] = useState(uploadTargets[0]?.id || "");
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const uploadHeading = useRef<HTMLHeadingElement>(null);

  const counts = useMemo(() => ({
    all: rows.filter((row) => normalizedStatus(row) !== "replaced").length,
    action: rows.filter((row) => isActionRequired(normalizedStatus(row))).length,
    pending: rows.filter((row) => ["pending", "pending_review", "review", "uploaded"].includes(normalizedStatus(row))).length,
    verified: rows.filter((row) => ["valid", "approved", "signed"].includes(normalizedStatus(row))).length
  }), [rows]);

  const categoryCounts = useMemo(() => rows.reduce<Record<string, number>>((acc, row) => {
    const key = categoryKey(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const status = normalizedStatus(row);
    const matchesSearch = !query || [row.name, row.document_type, row.context_name, row.garden_name, typeLabels[String(row.document_type)]].some((value) => String(value || "").toLocaleLowerCase("he").includes(query.toLocaleLowerCase("he")));
    const matchesCategory = category === "all" || categoryKey(row) === category;
    const matchesFilter = filter === "all"
      || (filter === "action" && isActionRequired(status))
      || (filter === "pending" && ["pending", "pending_review", "review", "uploaded"].includes(status))
      || (filter === "verified" && ["valid", "approved", "signed"].includes(status));
    return matchesSearch && matchesCategory && matchesFilter && status !== "replaced";
  }), [rows, query, category, filter]);

  const selected = rows.find((row) => row.id === selectedId) || filteredRows[0] || null;
  const versions = selected ? rows.filter((row) => row.id === selected.replaces_document_id || row.replaces_document_id === selected.id || row.replaced_by === selected.id || row.id === selected.replaced_by) : [];
  const selectedStatus = selected ? normalizedStatus(selected) : "unavailable";

  function openUpload(replaces?: DocumentsPlatformRow) {
    setReplacementId(replaces?.id || null);
    const matchingTarget = replaces ? uploadTargets.find((target) => target.gardenId === replaces.garden_id && (target.ownerId || null) === (replacementOwnerId(replaces) || null) && target.documentTypes.includes(String(replaces.document_type))) : null;
    setUploadTargetId(matchingTarget?.id || uploadTargets[0]?.id || "");
    setUploadMessage("");
    setUploadOpen(true);
    requestAnimationFrame(() => uploadHeading.current?.focus());
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    const target = uploadTargets.find((item) => item.id === String(data.get("target"))) || uploadTargets[0];
    if (!target || !(file instanceof File) || file.size === 0) {
      setUploadMessage("יש לבחור יעד וקובץ נתמך.");
      return;
    }
    setUploadMessage("");
    try {
      const created = await uploadManagementDocument(file, {
        garden_id: target.gardenId,
        ...(target.ownerId ? { owner_id: target.ownerId } : {}),
        name: String(data.get("name") || file.name),
        document_type: String(data.get("document_type") || target.documentTypes[0]),
        expires_at: String(data.get("expires_at") || ""),
        ...(replacementId ? { replaces_document_id: replacementId } : {})
      });
      const next: DocumentsPlatformRow = {
        ...created,
        garden_id: target.gardenId,
        owner_type: undefined,
        effective_status: created.status,
        context_name: target.label,
        created_at: new Date().toISOString(),
        expires_at: String(data.get("expires_at") || "") || null,
        mime_type: file.type,
        byte_size: file.size,
        replaces_document_id: replacementId,
        file_url: `/api/documents/${created.id}/file`
      };
      startTransition(() => {
        setRows((current) => [next, ...current.map((row) => row.id === replacementId ? { ...row, replaced_by: created.id, effective_status: "replaced" } : row)]);
        setSelectedId(created.id);
        setUploadMessage(replacementId ? "הגרסה החדשה הועלתה וההיסטוריה נשמרה." : "המסמך הועלה ונשלח לבדיקה.");
        form.reset();
      });
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "העלאת המסמך נכשלה. אפשר לנסות שוב.");
    }
  }

  return (
    <section className={`documents-platform ${selectedId ? "has-selected-document" : ""}`} dir="rtl">
      <header className="documents-hero">
        <div className="documents-hero-icon"><FolderOpen aria-hidden="true" /></div>
        <div>
          <span>מרכז מסמכים מאובטח · {roleLabel}</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="documents-hero-actions">
          <span className="documents-private-badge"><LockKeyhole /> אחסון פרטי</span>
          {uploadTargets.length ? <button className="button primary documents-upload-button" type="button" onClick={() => openUpload()}><UploadCloud /> העלאת מסמך</button> : null}
        </div>
      </header>

      {limitedMessage ? <aside className="documents-boundary-notice"><ShieldCheck /><div><strong>גישה מוגבלת לפי תפקיד</strong><span>{limitedMessage}</span></div></aside> : null}

      <div className="documents-metrics" aria-label="סיכום מסמכים">
        <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}><Folder /><span>כל המסמכים</span><strong>{counts.all}</strong></button>
        <button type="button" className={filter === "action" ? "active danger" : "danger"} onClick={() => setFilter("action")}><AlertTriangle /><span>דורשים פעולה</span><strong>{counts.action}</strong></button>
        <button type="button" className={filter === "pending" ? "active warning" : "warning"} onClick={() => setFilter("pending")}><Clock3 /><span>ממתינים לבדיקה</span><strong>{counts.pending}</strong></button>
        <button type="button" className={filter === "verified" ? "active success" : "success"} onClick={() => setFilter("verified")}><CheckCircle2 /><span>מאומתים</span><strong>{counts.verified}</strong></button>
      </div>

      <section className="documents-category-strip" aria-label="קטגוריות מסמכים">
        {Object.entries(categoryLabels).filter(([key]) => key === "all" || categoryCounts[key]).map(([key, label]) => (
          <button className={category === key ? "active" : ""} type="button" key={key} onClick={() => setCategory(key)}>
            <span><Folder aria-hidden="true" /></span><b>{label}</b><small>{key === "all" ? counts.all : categoryCounts[key] || 0} מסמכים</small>
          </button>
        ))}
      </section>

      <div className="documents-workspace">
        <div className="documents-list-pane">
          <div className="documents-toolbar">
            <label><Search aria-hidden="true" /><span className="sr-only">חיפוש מסמכים</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי שם, סוג או בעלים..." /></label>
            <span><Filter /> {filteredRows.length} תוצאות</span>
          </div>
          <div className="documents-list" role="list">
            {filteredRows.map((row) => {
              const Icon = iconFor(row);
              const status = normalizedStatus(row);
              return (
                <button className={`document-list-card ${selected?.id === row.id ? "selected" : ""}`} type="button" key={row.id} onClick={() => setSelectedId(row.id)} role="listitem">
                  <span className={`document-file-icon ${row.mime_type?.startsWith("image/") ? "image" : "pdf"}`}><Icon aria-hidden="true" /></span>
                  <span className="document-list-copy"><strong>{row.name || typeLabels[String(row.document_type)] || "מסמך"}</strong><small>{row.context_name || row.garden_name || typeLabels[String(row.document_type)] || "מסמך פרטי"}</small><em>{dateText(row.created_at)} · {sizeText(row.byte_size)}</em></span>
                  <span className={`document-status ${statusTone(status)}`}>{statusLabels[status] || status}</span>
                  <ChevronLeft className="document-row-arrow" aria-hidden="true" />
                </button>
              );
            })}
            {!filteredRows.length ? <div className="documents-empty"><FolderOpen /><h3>{query ? "לא נמצאו מסמכים" : "אין מסמכים בתצוגה הזו"}</h3><p>{query ? "נסו שם, סוג מסמך או בעלים אחר." : "אין כרגע מסמכים בקטגוריה או בסטטוס שנבחרו."}</p>{query ? <button type="button" onClick={() => setQuery("")}>ניקוי חיפוש</button> : null}</div> : null}
          </div>
        </div>

        <aside className="document-detail-pane" aria-live="polite">
          {selected ? <>
            <button className="document-mobile-back" type="button" onClick={() => setSelectedId(null)}><ChevronLeft /> חזרה למסמכים</button>
            <header className="document-detail-head">
              <span className="document-preview-icon"><FileCheck2 /></span>
              <div><small>{typeLabels[String(selected.document_type)] || "מסמך"}</small><h3>{selected.name || "מסמך"}</h3><p>{selected.context_name || selected.garden_name || "רשומה פרטית"}</p></div>
              <span className={`document-status ${statusTone(selectedStatus)}`}>{statusLabels[selectedStatus] || selectedStatus}</span>
            </header>

            <div className="document-secure-preview">
              <span><LockKeyhole /> תצוגה מאובטחת</span>
              {selectedStatus === "unavailable" ? <div><AlertTriangle /><b>התצוגה אינה זמינה</b><small>פרטי המסמך נשמרים, אך הקובץ אינו זמין בהרשאה הנוכחית.</small></div> : <div><FileText /><b>{selected.mime_type === "application/pdf" ? "PDF" : selected.mime_type?.startsWith("image/") ? "IMAGE" : "FILE"}</b><small>הקובץ ייפתח רק לאחר בדיקת הרשאה וקישור חתום קצר־טווח.</small></div>}
            </div>

            {selectedStatus === "rejected" ? <div className="document-decision-banner bad"><AlertTriangle /><div><strong>המסמך נדחה — נדרשת החלפה</strong><span>{selected.rejection_reason || "נדרש קובץ תקין וברור יותר. הסיבה המלאה זמינה למשתמש המורשה."}</span></div></div> : null}
            {selectedStatus === "expired" ? <div className="document-decision-banner bad"><RefreshCw /><div><strong>תוקף המסמך הסתיים</strong><span>יש להעלות גרסה עדכנית. הגרסה הקודמת תישמר בהיסטוריה.</span></div></div> : null}
            {selectedStatus === "expiring_soon" ? <div className="document-decision-banner warn"><Clock3 /><div><strong>התוקף מסתיים בקרוב</strong><span>אפשר להכין מסמך חלופי לפני תאריך התוקף.</span></div></div> : null}
            {["valid", "approved", "signed"].includes(selectedStatus) ? <div className="document-decision-banner good"><ShieldCheck /><div><strong>המסמך מאומת</strong><span>האימות בוצע בסמכות השרת ונשמר ברשומת הביקורת.</span></div></div> : null}

            <dl className="document-metadata">
              <div><dt>קטגוריה</dt><dd>{typeLabels[String(selected.document_type)] || selected.document_type || "כללי"}</dd></div>
              <div><dt>בעלים / הקשר</dt><dd>{selected.context_name || selected.garden_name || "מורשה בלבד"}</dd></div>
              <div><dt>תאריך העלאה</dt><dd>{dateText(selected.created_at)}</dd></div>
              <div><dt>תוקף</dt><dd>{dateText(selected.expires_at)}</dd></div>
              <div><dt>אימות</dt><dd>{selected.reviewed_at ? dateText(selected.reviewed_at) : "טרם אומת"}</dd></div>
              <div><dt>קובץ</dt><dd>{sizeText(selected.byte_size)}</dd></div>
            </dl>

            <div className="document-detail-actions">
              {selected.file_url ? <a className="button primary" href={`/api/documents/${selected.id}/file`} target="_blank" rel="noreferrer"><Eye /> פתיחה מאובטחת</a> : <button className="button primary" type="button" disabled><Eye /> תצוגה לא זמינה</button>}
              {selected.file_url ? <a className="button secondary" href={`/api/documents/${selected.id}/file`} download><Download /> הורדה</a> : null}
              {uploadTargets.length && !["replaced", "missing", "required"].includes(selectedStatus) ? <button className="button secondary" type="button" onClick={() => openUpload(selected)}><RefreshCw /> החלפת מסמך</button> : null}
            </div>
            {canReview && selected.can_review !== false && ["pending", "pending_review", "review", "uploaded"].includes(selectedStatus) ? <div className="document-review-zone"><strong>בדיקת מסמך</strong><span>אישור ודחייה נשמרים בשרת וביומן הביקורת.</span><DocumentReviewActions id={selected.id} /></div> : null}

            <section className="document-history-card">
              <header><History /><div><strong>היסטוריה וגרסאות</strong><span>החלפה אינה מוחקת את הרשומה הקודמת</span></div></header>
              <ol>
                <li><Check /><span><b>גרסה נוכחית</b><small>{dateText(selected.created_at)} · {statusLabels[selectedStatus] || selectedStatus}</small></span></li>
                {versions.map((version) => <li key={version.id}><Archive /><span><b>{version.name || "גרסה קודמת"}</b><small>{dateText(version.created_at)} · {statusLabels[normalizedStatus(version)] || normalizedStatus(version)}</small></span></li>)}
                {!versions.length ? <li className="muted"><History /><span><b>אין גרסאות קודמות</b><small>היסטוריה תופיע לאחר החלפה קנונית.</small></span></li> : null}
              </ol>
            </section>
          </> : <div className="documents-empty detail"><FolderOpen /><h3>בחרו מסמך</h3><p>פרטי הקובץ, הסטטוס והפעולות המאובטחות יוצגו כאן.</p></div>}
        </aside>
      </div>

      {uploadOpen ? <div className="document-upload-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setUploadOpen(false); }}>
        <section className="document-upload-sheet" role="dialog" aria-modal="true" aria-labelledby="document-upload-title">
          <header><div><span><UploadCloud /></span><div><h3 id="document-upload-title" ref={uploadHeading} tabIndex={-1}>{replacementId ? "החלפת מסמך" : "העלאת מסמך חדש"}</h3><p>PDF או תמונה עד 12MB. הקובץ נשמר באחסון פרטי.</p></div></div><button type="button" onClick={() => setUploadOpen(false)} aria-label="סגירת חלון העלאה"><X /></button></header>
          <form onSubmit={submitUpload}>
            <label>יעד המסמך<select name="target" required value={uploadTargetId} onChange={(event) => setUploadTargetId(event.target.value)}>{uploadTargets.map((target) => <option value={target.id} key={target.id}>{target.label}</option>)}</select></label>
            <label>סוג מסמך<select name="document_type" required key={uploadTargetId} defaultValue={uploadTargets.find((target) => target.id === uploadTargetId)?.documentTypes[0]}>{(uploadTargets.find((target) => target.id === uploadTargetId)?.documentTypes || []).map((type) => <option value={type} key={type}>{typeLabels[type] || type}</option>)}</select></label>
            <label className="wide">שם המסמך<input name="name" required minLength={2} maxLength={160} placeholder="לדוגמה: אישור בטיחות שנתי" /></label>
            <label>תוקף עד<input name="expires_at" type="date" /></label>
            <label className="document-file-drop wide"><FileUp /><b>{replacementId ? "בחרו קובץ חלופי" : "בחרו קובץ להעלאה"}</b><span>PDF, JPG, PNG או WEBP · עד 12MB</span><input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required /></label>
            {uploadMessage ? <p className={uploadMessage.includes("הועלה") || uploadMessage.includes("נשמרה") ? "document-upload-success" : "document-upload-error"} role="status">{uploadMessage}</p> : null}
            <footer><button className="button secondary" type="button" onClick={() => setUploadOpen(false)}>ביטול</button><button className="button primary" type="submit" disabled={isPending}>{isPending ? "מעלה באופן מאובטח..." : replacementId ? "העלאת גרסה חדשה" : "העלאת מסמך"}</button></footer>
          </form>
        </section>
      </div> : null}
    </section>
  );
}
