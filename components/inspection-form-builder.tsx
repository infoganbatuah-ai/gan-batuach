"use client";

import { useMemo, useState, type FormEvent } from "react";

type FormRow = { id: string; name: string; description?: string | null; active?: boolean | null; frequency_months?: number | null };
type QuestionRow = { id: string; form_id: string; category: string; question_text: string; question_type?: string | null; weight?: number | null; critical?: boolean | null; required?: boolean | null; sort_order?: number | null };
type Person = { id: string; full_name?: string | null; role?: string | null; city?: string | null; name?: string | null };

async function postJson(url: string, payload: unknown, method = "POST") {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
  return body.data;
}

const questionTypes = [
  ["score_1_10", "ציון 1-10"],
  ["boolean", "כן / לא"],
  ["text_note", "טקסט / הערה"],
  ["photo_upload", "צילום חובה"],
  ["document_upload", "מסמך חובה"]
];

const defaultCategories = ["licensing/basic documents", "staff records", "background checks", "staff-child ratio", "child safety", "building safety", "yard safety", "kitchen/food", "hygiene", "first aid", "emergency readiness", "child medical records", "pickup authorization", "cameras", "parent transparency", "incident reporting", "complaints handling", "daily schedule", "educational environment", "privacy/data protection"];

export function InspectionFormBuilder({ forms, questions, inspectors, gardens }: { forms: FormRow[]; questions: QuestionRow[]; inspectors: Person[]; gardens: Person[] }) {
  const [allForms, setAllForms] = useState(forms);
  const [allQuestions, setAllQuestions] = useState(questions);
  const [selectedFormId, setSelectedFormId] = useState(forms[0]?.id || "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedForm = allForms.find((form) => form.id === selectedFormId);
  const selectedQuestions = useMemo(() => allQuestions.filter((question) => question.form_id === selectedFormId).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)), [allQuestions, selectedFormId]);

  async function createForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setError(null); setMessage(null);
    try {
      const created = await postJson("/api/inspection-forms", { name: String(data.name), description: String(data.description || ""), framework_type: String(data.framework_type || "mixed"), active: false, frequency_months: Number(data.frequency_months || 1) });
      setAllForms((current) => [created, ...current]);
      setSelectedFormId(created.id);
      setMessage("טופס חדש נוצר כטיוטה.");
      form.reset();
    } catch (err) { setError(err instanceof Error ? err.message : "יצירת טופס נכשלה"); }
  }

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setError(null); setMessage(null);
    try {
      const question = await postJson("/api/inspection-form-questions", { form_id: selectedFormId, category: String(data.category), question_text: String(data.question_text), question_type: String(data.question_type), required: Boolean(data.required), critical: Boolean(data.critical), weight: Number(data.weight || 1), requires_note: Boolean(data.requires_note), requires_photo: data.question_type === "photo_upload" || Boolean(data.requires_photo), requires_document: data.question_type === "document_upload" || Boolean(data.requires_document), sort_order: selectedQuestions.length * 10 + 10 });
      setAllQuestions((current) => [...current, question]);
      setMessage("השאלה נוספה לטופס.");
      form.reset();
    } catch (err) { setError(err instanceof Error ? err.message : "הוספת שאלה נכשלה"); }
  }

  async function publishForm() {
    if (!selectedForm) return;
    setError(null); setMessage(null);
    try {
      const updated = await postJson("/api/inspection-forms", { id: selectedForm.id, active: true }, "PATCH");
      setAllForms((current) => current.map((form) => form.id === updated.id ? { ...form, ...updated } : form));
      setMessage("הטופס פורסם וזמין לפקחים.");
    } catch (err) { setError(err instanceof Error ? err.message : "פרסום הטופס נכשל"); }
  }

  async function assignForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    setError(null); setMessage(null);
    try {
      await postJson("/api/inspection-form-assignments", { form_id: selectedFormId, inspector_id: String(data.inspector_id || "") || null, garden_id: String(data.garden_id || "") || null, monthly_schedule: Boolean(data.monthly_schedule) });
      setMessage("הטופס שויך בהצלחה לפיקוח חודשי.");
    } catch (err) { setError(err instanceof Error ? err.message : "שיוך הטופס נכשל"); }
  }

  return (
    <div className="builder-layout">
      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="success-banner">{message}</div> : null}
      <section className="grid cols-2 dashboard-panels">
        <form className="card form wizard-form" onSubmit={createForm}>
          <h2>יצירת טופס פיקוח</h2>
          <p>טופס מתחיל כטיוטה. לאחר הוספת קטגוריות ושאלות אפשר לפרסם אותו לפקחים.</p>
          <div className="form-grid"><label>שם טופס<input name="name" required defaultValue="טופס פיקוח חודשי - גן בטוח" /></label><label>סוג מסגרת<select name="framework_type"><option value="mixed">מעורב</option><option value="birth_to_3">לידה עד 3</option><option value="3_to_6">3 עד 6</option></select></label><label>תדירות חודשית<input name="frequency_months" type="number" min="1" defaultValue="1" /></label><label className="wide">תיאור<textarea name="description" rows={3} /></label></div>
          <button className="button primary">יצירת טופס</button>
        </form>
        <article className="card action-panel">
          <h2>טפסים קיימים</h2>
          <div className="stack-list">{allForms.map((form) => <button className={form.id === selectedFormId ? "quick-action selected-choice" : "quick-action"} key={form.id} onClick={() => setSelectedFormId(form.id)}><strong>{form.name}</strong><span>{form.active ? "פורסם" : "טיוטה"} · כל {form.frequency_months || 1} חודש</span></button>)}</div>
        </article>
      </section>
      {selectedForm ? <section className="grid cols-2 dashboard-panels"><form className="card form wizard-form" onSubmit={addQuestion}><h2>הוספת שאלה</h2><div className="form-grid"><label>קטגוריה<input name="category" list="inspection-categories" required /></label><datalist id="inspection-categories">{defaultCategories.map((category) => <option value={category} key={category} />)}</datalist><label>סוג שאלה<select name="question_type">{questionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>משקל<input name="weight" type="number" min="0.1" step="0.1" defaultValue="1" /></label><label className="wide">טקסט שאלה<textarea name="question_text" rows={3} required /></label></div><div className="consent-grid"><label><input name="required" type="checkbox" defaultChecked /> חובה</label><label><input name="critical" type="checkbox" /> קריטית</label><label><input name="requires_note" type="checkbox" /> הערה חובה</label><label><input name="requires_photo" type="checkbox" /> צילום</label><label><input name="requires_document" type="checkbox" /> מסמך</label></div><button className="button primary">הוספת שאלה</button></form><article className="card action-panel"><h2>תצוגת פקח</h2><p>כך הפקח יראה את הטופס: קטגוריות, התקדמות, ציון, הערות והוכחות.</p><div className="progress-bar"><span style={{ width: selectedQuestions.length ? "38%" : "8%" }} /></div><div className="inspection-preview-list">{selectedQuestions.length === 0 ? <div className="empty-mini">אין שאלות בטופס עדיין.</div> : selectedQuestions.map((question) => <div className="inspection-preview-question" key={question.id}><span className="pill bad">{question.critical ? "קריטי" : question.question_type || "score"}</span><strong>{question.category}</strong><p>{question.question_text}</p><small>משקל {question.weight || 1} · ציון 1-4 ייצור ליקוי אדום ומשימת תיקון</small></div>)}</div><div className="actions"><button className="button primary" onClick={publishForm}>פרסום טופס</button></div></article></section> : null}
      {selectedForm ? <section className="card form wizard-form"><h2>שיוך לפקחים ולפיקוח חודשי</h2><form onSubmit={assignForm} className="form-grid"><label>פקח<select name="inspector_id"><option value="">כל פקח לפי שיוך גן</option>{inspectors.map((inspector) => <option key={inspector.id} value={inspector.id}>{inspector.full_name}</option>)}</select></label><label>גן<select name="garden_id"><option value="">כל הגנים הרלוונטיים</option>{gardens.map((garden) => <option key={garden.id} value={garden.id}>{garden.name}</option>)}</select></label><label><input name="monthly_schedule" type="checkbox" defaultChecked /> יצירת משימה חודשית</label><button className="button secondary">שמירת שיוך</button></form></section> : null}
    </div>
  );
}
