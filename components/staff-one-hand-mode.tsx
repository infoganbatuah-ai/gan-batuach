"use client";

import { QuickChildOps } from "@/components/quick-child-ops";
import { Avatar } from "@/components/avatar";

type Child = {
  id: string;
  garden_id?: string | null;
  full_name: string;
  photo_url?: string | null;
  face_image_url?: string | null;
  allergies?: string | null;
  medical_notes?: string | null;
  mood?: string | null;
};

export function StaffOneHandMode({ children }: { children: Child[] }) {
  return (
    <section className="staff-one-hand-mode">
      <div className="section-heading">
        <div>
          <p className="eyebrow">One-Hand Mode</p>
          <h2>עדכון ילד ב-10 שניות</h2>
          <p>כרטיסים גדולים לצוות: אכל, ישן, שמח, אירוע או בגדים. בלי טפסים ארוכים.</p>
        </div>
        <span className="pill good">{children.length} ילדים</span>
      </div>
      {children.length === 0 ? <div className="empty-state"><strong>אין ילדים למשמרת</strong><span>כאשר ילדים משויכים לגן, הם יופיעו כאן לעדכון מהיר.</span></div> : (
        <div className="one-hand-grid">
          {children.map((child) => (
            <article className="one-hand-child-card" key={child.id}>
              <Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} size="lg" />
              <div>
                <h3>{child.full_name}</h3>
                <p>{child.allergies || child.medical_notes ? "יש דגש בריאותי" : "עדכון מהיר"}</p>
              </div>
              <QuickChildOps childId={child.id} gardenId={child.garden_id} basePath="/dashboard/staff" />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
