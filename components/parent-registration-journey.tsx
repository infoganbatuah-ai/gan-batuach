import { Baby, CalendarDays, CheckCircle2, HeartHandshake, Send, UserRound } from "lucide-react";
import { createParentLead } from "@/app/actions";
import { formatAgeGroups, type KindergartenAgeGroup } from "@/lib/kindergarten-age-groups";

type GardenSummary = {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  logo_url?: string | null;
  image_url?: string | null;
};

const steps = [
  { icon: UserRound, label: "פרטי הורה" },
  { icon: Baby, label: "פרטי ילד" },
  { icon: CalendarDays, label: "תאריך כניסה לגן" },
  { icon: Send, label: "שליחה לאישור הגן" }
];

export function ParentRegistrationJourney({ garden, ageGroups, compact = false }: { garden: GardenSummary; ageGroups: KindergartenAgeGroup[]; compact?: boolean }) {
  return (
    <section className={compact ? "registration-journey compact" : "registration-journey"} id="registration">
      <div className="registration-banner">
        <div className="garden-logo-orb">{garden.logo_url || garden.image_url ? <img src={garden.logo_url ?? garden.image_url ?? ""} alt={garden.name} /> : <HeartHandshake />}</div>
        <div>
          <p className="eyebrow">רישום הורה לגן</p>
          <h2>מצטרפים לגן {garden.name}</h2>
          <p>השאירו פרטים בסיסיים והגן יחזור לאישור ההצטרפות. את פרטי הילד המלאים משלימים רק אחרי שהגן מאשר את הבקשה.</p>
          <div className="tag-cloud"><span>{garden.city ?? "עיר לא צוינה"}</span><span>מקבל: {formatAgeGroups(ageGroups)}</span></div>
        </div>
      </div>

      <div className="journey-steps" aria-label="שלבי רישום">
        {steps.map((step, index) => <span key={step.label}><b>{index + 1}</b><step.icon size={17} /> {step.label}</span>)}
      </div>

      <form action={createParentLead} className="premium-step-form">
        <input type="hidden" name="garden_id" value={garden.id} />
        <input type="hidden" name="success_redirect" value={`/join-parent?gardenId=${garden.id}&lead=sent`} />
        <div className="form-progress-line"><span style={{ width: "35%" }} /></div>
        <details className="accordion-step premium-open" open>
          <summary><strong>1. פרטי הורה</strong><span>מי שולח את הבקשה?</span></summary>
          <div className="form-grid">
            <label>שם הורה מלא<input name="parent_name" required placeholder="שם פרטי ומשפחה" /></label>
            <label>טלפון<input name="phone" required placeholder="050-0000000" /></label>
            <label className="wide">מייל אופציונלי<input name="email" type="email" placeholder="name@example.com" /></label>
          </div>
        </details>

        <details className="accordion-step">
          <summary><strong>2. פרטי ילד</strong><span>רק מה שצריך כדי שהגן יבדוק התאמה</span></summary>
          <div className="form-grid">
            <label>שם הילד<input name="child_name" required /></label>
            <label>גיל הילד<input name="child_age" required placeholder="לדוגמה: 2.5" /></label>
            {ageGroups.length ? (
              <label className="wide">קבוצת גיל / כיתה מבוקשת<select name="requested_age_group" required><option value="">בחירת קבוצה</option>{ageGroups.map((group) => <option value={group.label} key={group.id ?? group.label}>{group.age_range ? `${group.label} · ${group.age_range}` : group.label}</option>)}</select></label>
            ) : (
              <div className="gateway-setup-state wide"><strong>הגן עדיין לא הגדיר קבוצות גיל.</strong><p>אפשר לשלוח בקשה, והגן ישייך את הילד לקבוצה לאחר בדיקה.</p><input name="requested_age_group" type="hidden" value="" /></div>
            )}
          </div>
        </details>

        <details className="accordion-step">
          <summary><strong>3. תאריך כניסה וכתובת</strong><span>כדי שהגן יבין זמינות ומיקום</span></summary>
          <div className="form-grid">
            <label>כתובת מלאה<input name="address" required /></label>
            <label>תאריך התחלה מבוקש<input name="requested_start_date" type="date" required /></label>
            <label className="wide">הערות אופציונליות<textarea name="notes" rows={3} placeholder="כל דבר שחשוב שהגן ידע לפני יצירת קשר" /></label>
          </div>
        </details>

        <div className="journey-submit-card">
          <CheckCircle2 />
          <div><strong>מה קורה אחרי השליחה?</strong><span>הבקשה תופיע למנהלת הגן. לאחר אישור תקבלו פרטי כניסה להשלמת רישום הילד.</span></div>
          <button className="button primary large" type="submit">שליחה לאישור הגן</button>
        </div>
      </form>
    </section>
  );
}
