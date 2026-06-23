# RESCUE 3 Parent Screen Matrix

Status date: 2026-06-23

UXQA 3A update: QA pass completed against the local parent references. Browser screenshot diff was not generated because Playwright is not installed in this environment. Findings below reflect code/path/action review plus successful typecheck/build verification.

Reference source: `docs/ux-references/parent/` is not present in this checkout. The supplied parent references were available locally under `/Users/danielderi/Desktop/עיצוב גן בטוח/הורים/` and were used as the visual target.

Implementation rule: preserve parent routes, data loading, existing requests, auth/RLS/payment/camera/AI boundaries, and apply the approved Gan Batuach app language.

| Reference area | Screenshot filename | Existing route | Current component/page | Existing data source | Existing actions/API routes | Visual gaps | Functional gaps | Privacy restrictions | Provider requirements | Implementation status |
|---|---|---|---|---|---|---|---|---|---|---|
| Parent registration | `רישום הורים/רישום הורים.png` | `/app/register/parent`, `/register`, `/parent-onboarding` | `AppRoleRegisterScreen`, `ParentChildRegistrationWizard` | existing auth/profile/self-service flow | Supabase auth/profile creation and parent onboarding | exact screenshot visual QA still manual | no duplicate user model added | parent-only fields; no manager/staff fields | none beyond auth email mode | implemented with manual_visual_review_required |
| Add child details | `הוספת פרטי ילד דשבורד הורים.png` | `/parent-onboarding`, `/dashboard/parent#child-profile` | `parent-onboarding/page.tsx`, `ParentChildProfileForm`, `ParentChildRegistrationWizard` | `children`, `documents`, `parents`, age groups | existing child registration/update components | upgraded into parent app frame; wizard internals may need later visual pass | dependent on existing wizard validations | child medical/identity data remains under existing permissions | document upload provider/storage | implemented partially; requires manual form UX review |
| Parent main dashboard | `דשבורד הורים ראשי.png` | `/dashboard/parent`, `/dashboard/parent/family-home` | `parent/page.tsx`, `family-home/page.tsx` | parents, permanent child files, enrollments, requests, schedule items, gardens | dashboard links, add child, discovery, messages, cameras, payments | `/family-home` still has deeper compatibility sections | none blocking | no other children/parents queried | none | implemented; QA fixed hardcoded date and fallback safety score |
| Parent without kindergarten discovery | `רשימת גני ילדים בדשבורד הורים שאינו משויך לגן.png` | `/dashboard/parent/discover-kindergartens` | `discover-kindergartens/page.tsx` | public active gardens and public fee groups | `EnrollmentRequestButton` | exact screenshot visual QA still manual | service-role/public discovery config required | public-safe garden fields only | admin/service role for directory read path | implemented; QA removed distance/rating wording that had no computed backend |
| Child daily schedule | `לוז יום ילד דשבורד הורים.png` | `/dashboard/parent/schedule`, `/dashboard/parent/daily-journal` | `schedule/page.tsx`, `daily-journal/page.tsx` | `schedule_items`, `child_daily_journals` | journal/schedule links | manual visual QA needed | no hardcoded timeline rows in schedule | parent-visible schedule/journal only | none | implemented with real data/empty states |
| Development and learning | `התפתחות ולמידה דשבורד הורים.png` | `/dashboard/parent/children/[id]/timeline`, `/dashboard/parent/daily-journal` | timeline/profile pages | `child_timeline_events`, `child_unified_records`, journals | timeline and messages links | exact learning reference needs later visual detail | no diagnosis flow added | parent-visible, non-internal events only | none | implemented as safe timeline/development surface |
| Messages and communication | `הודעות ותקשורת דשבורד הורים.png` | `/dashboard/parent/messages` | `messages/page.tsx`, `ParentChildRequestForm` | parent-child requests, scoped children/gardens | message/request form | manual visual QA needed | provider delivery/read status depends on backend | scoped to parent profile and own child ids | messaging/email/SMS provider for external delivery | implemented; no unrelated recipients exposed in reviewed query |
| Payments and charges | `תשלומים וחיובים דשבורד הורים.png` | `/dashboard/parent/payments` | `payments/page.tsx` | parent family enrollments and child payment fields | question-to-garden link | exact payment reference visual QA manual | live payment action not invented | only own child payment state | payment provider for live retry/approve flows | preserved; tuition separated from Gan Batuach subscription |
| Parent camera viewing | `מצלמות דשבורד הורים.png` | `/dashboard/parent/cameras` | `cameras/page.tsx`, `CameraPlaybackCard` | `getParentCameraListForProfile` | playback token flow through existing card/API | manual visual QA needed | live stream requires gateway | no RTSP/IP/credentials shown; requires existing parent camera checks | camera gateway/provider | implemented; no fake live/AI event presentation found in QA |
| Safety and activity report | `דוח בטיחות ופעילות דשבורד הורים.png` | `/dashboard/parent/trust-center`, `/dashboard/parent/inspections`, `/dashboard/parent/ai-events` | trust center/report pages | approved trust feed, inspections, parent-visible AI summaries | report/trust links | exact report reference visual QA manual | downloads depend on existing report generation | no raw AI/internal defects exposed | report export provider if any | retained with privacy constraints |

## Existing Parent Features Not Represented Directly In References

| Feature | Route | Preservation status |
|---|---|---|
| Documents | `/dashboard/parent/documents` | preserved; requires later visual migration check |
| Pickup permissions/events | `/dashboard/parent/pickup` | preserved; no permission logic changed |
| Gallery | `/dashboard/parent/gallery` | preserved; parent-visible media only |
| Complaints | `/dashboard/parent/complaints` | preserved |
| Notifications/preferences | `/dashboard/parent/notifications` | preserved |
| Profile/settings/security | `/dashboard/parent/settings`, `/dashboard/security-settings` | preserved |
| Trust center and inspections | `/dashboard/parent/trust-center`, `/dashboard/parent/inspections` | preserved |
| Child timeline | `/dashboard/parent/children/[id]/timeline` | preserved; parent-visible scope only |

No parent route was deleted.
