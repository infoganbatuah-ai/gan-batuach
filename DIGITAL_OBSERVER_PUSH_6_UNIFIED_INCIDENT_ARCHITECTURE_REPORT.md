# DIGITAL OBSERVER — PUSH 6

## FINAL STATUS

**PASS**

הוקם חוזה Incident קנוני אחד מעל זרם האירועים האמיתי. צמד אירועי `person_entered` ו־`person_exited` אמיתיים, מאותה מצלמה ומאותו Track ID, קובץ אוטומטית לתקרית אחת סגורה. אירוע כניסה אמיתי נוסף עם Track ID אחר פתח תקרית נפרדת. הממשק המאומת מציג את שתי התקריות ואת ציר הזמן המקורי.

## EXISTING SYSTEM INVENTORY

| System | Role | Active | Real data | Decision |
|---|---|---:|---:|---|
| `observer_intelligence_signals` | מקור האירועים העובדתיים הקנוני | כן | כן, `REAL_CAMERA_AI` | KEEP |
| Gateway Journal / Outbox | יצירה ומסירה של אירועים מנורמלים | כן | כן | KEEP |
| `observer_correlated_events` + links | תשתית קורלציה קיימת | כן, חלקית | לא לפני PUSH 6 | ADAPT כ־Incident הקנוני |
| `ai_camera_events` | מסלול AI ותיק/בדיקות | כן, מוגבל | בעיקר mock/shadow | LEGACY; לא מקור אמת |
| `incident_reports` | תיקי תפעול/דיווח של תחום הגנים | כן | תחום אחר | KEEP מבודד; לא Incident של התצפיתן |
| `incident_timeline` / `/api/incidents` | API תקריות כללי ותיק | כן | לא מסלול המצלמה הקנוני | LEGACY COMPATIBILITY |
| Notifications | שכבת מסירה/Alert | כן | לפי Signal | KEEP; Alert אינו Incident |
| `/digital-observer/alerts` | פיד Events עובדתי | כן | כן | KEEP לחקירה מפורטת |

לא נמחקו מערכות או נתונים קיימים.

## CANONICAL TERMINOLOGY

- **Detection:** פלט AI נמוך־רמה, לדוגמה תיבת `person` וביטחון.
- **Track / Observation:** רציפות זמנית של ישות מזוהה.
- **Event:** עובדה או מעבר מצב מנורמל, כגון `person_entered` או `person_exited`.
- **Incident:** מצב משמעותי הכולל Event אחד או יותר הקשורים לאותה התרחשות.
- **Alert:** תקשורת/פעולה שנוצרת ממדיניות; אינה Event ואינה Incident.

## CANONICAL INCIDENT MODEL

המודל הקיים `observer_correlated_events` הותאם באופן תוספתי. נוספו: כותרת, סיכום, זמני פתיחה/פעילות/סגירה, מצלמה ראשית, Track IDs, Event IDs קשורים, provenance, גרסת קורלציה ומקור יוצר. ציר הזמן נשמר בקישורי `observer_correlated_event_links`; מדיה אינה מועתקת.

הגרסה הקנונית היא `do-track-v1`, ולכן נתוני correlation ותיקים נשארים מובחנים.

## CORRELATION CONTRACT

הכלל השמרני הראשוני:

`REAL_CAMERA_AI` + אותו tenant/site + אותה מצלמה + אותו Track ID + חלון פעילות של עד 10 דקות + רצף Event תואם.

`person_entered` פותח Incident. `person_exited` מצטרף ל־Incident הפעיל וסוגר אותו. `person_detected` לבדו אינו פותח Incident כדי למנוע הצפה. אירוע ממצלמה/אתר/Track אחר אינו מתמזג. אין cross-camera Re-ID.

## INCIDENT STATE MACHINE

המצבים הקנוניים: `OPEN`, `ACKNOWLEDGED`, `RESOLVED`, `CLOSED`.

מעברים חוקיים נשמרים במפורש; Incident סגור אינו נפתח מחדש. יציאה ללא כניסה קודמת אינה יוצרת Incident מלאכותי. סגירה אוטומטית בתרחיש הנוכחי מתבצעת על `person_exited`; סגירה לפי inactivity נשארה להקשחה עתידית.

## REAL ENTRY/EXIT INCIDENT

- Incident ID: `8b7fe035-8011-4550-ba9f-26a4e6ab03d4`
- Site: `cc1673b8-3eb0-4785-a12c-1fb88f425a41`
- Camera/source: `e9f8abf3-5895-494e-b1cf-ea8818602851`
- Track: `a3788a50-edc1-4643-a7d3-371af89a410e`
- Entry Event: `f24f7f2f-f282-48ae-977b-339e305f3fb4`, confidence `0.888`
- Exit Event: `76f5489e-a28d-4096-b6df-aecd7d7df140`, confidence `0.868`
- State: `CLOSED`
- Timeline: כניסה ב־2026-09-05T18:29:32.778Z, יציאה ב־2026-09-05T18:30:14.997Z
- Provenance: `REAL_CAMERA_AI`

ה־Events נוצרו קודם לכן אוטומטית מהמצלמה האמיתית. PUSH 6 הפעיל עליהם את מנגנון הקורלציה הקנוני; לא נוצרו Event ידני, seed או mock.

## SECOND INCIDENT TEST

Event אמיתי נוסף `47c57dca-0472-4426-bc30-88a0fa2d9437`, עם Track ID שונה, יצר Incident נפרד `4c436f4b-7240-4578-9e90-bbf0cb79c027` במצב `OPEN`. הוא לא צורף לתקרית הסגורה.

## NEGATIVE CORRELATION TESTS

בדיקות אוטומטיות מאשרות שאירועים מ־Track, מצלמה, אתר או tenant אחרים אינם מתמזגים; Event ישן אינו מזהם Incident חדש; `mock`/`local_shadow` נדחים; יציאה ללא מצב כניסה אינה פותחת Incident.

## IDEMPOTENCY

Event ID יציב וקישור מקור ייחודי מונעים כפילות. מסירה חוזרת של Event הכניסה החזירה את אותו Incident, ללא פריט Timeline נוסף. נעילת advisory מגינה גם מפני קורלציה מקבילית.

## EVIDENCE ASSOCIATION

ה־Incident מפנה ל־Event המקורי ול־evidence reference שלו (`line_crossing`). אין העתקת snapshot/clip ואין שינוי במדיניות הרשאה או retention. נושא hostname/playback הקיים נשאר תחום הקשחה נפרד ל־PUSH 7.

## PRODUCT UI/API RESULT

נוספו API מאומת ומוגבל־אתר ב־`/api/digital-observer/incidents` ומסך `/digital-observer/incidents`.

אימות Production בדפדפן המחובר עבר:

- מוצגות שתי תקריות נפרדות.
- התקרית הסגורה מוצגת עם הסיכום: "אדם נכנס לאזור המצולם ולאחר מכן יצא."
- ציר הזמן מציג כניסה (89%) ואחריה יציאה (87%).
- כל פריט מקשר ל־Event העובדתי המקורי ב־Alerts.
- ה־Events נשארים נגישים בנפרד ואינם מוסתרים.

Deployment: `dpl_A29rCksqm4c3Az2KHQqy7QRouWHq`, Production READY, alias `ganbatuach.com`.

## LEGACY COMPATIBILITY

הטבלאות וה־APIs הקיימים לא הוסרו. רשומות correlation ותיקות נשמרות ללא `do-track-v1`; `incident_reports` נשאר תחום תפעולי נפרד. לא בוצעה מיגרציה היסטורית רחבה. מסלול קריאה/ניקוי מאוחד לנתונים ותיקים מומלץ ב־PUSH ייעודי עתידי.

## AUDITABILITY

כל Incident שומר גרסת כלל, provenance, אתר, מצלמה, Track IDs, Event IDs, סדר כרונולוגי וסיבת correlation דטרמיניסטית. העובדות המקוריות אינן משתנות.

## TEST MATRIX

| Test | Result | Evidence |
|---|---|---|
| Incident contract A–J | PASS | same-track pair, dedupe, boundaries, chronology, provenance/evidence |
| Real persisted entry/exit correlation | PASS | Incident `8b7fe035-...` closed with two real Events |
| Second real Incident boundary | PASS | Incident `4c436f4b-...` separate/open |
| Journal / ingest / outbox / inference / media QA | PASS | `qa:event-journal` |
| Real detection → Event bridge | PASS | `qa:real-detection-event-bridge` |
| Product Observer provenance/mock isolation | PASS | `qa:product-observer-real-source` |
| DVR shared-session safety | PASS | `qa:dvr-shared-session` |
| TypeScript | PASS | `npm run typecheck` |
| Focused lint | PASS WITH WARNING | no errors; existing `<img>` optimization warning in app shell |
| Production build | PASS | 481 pages; Incident API/UI included |
| Production deployment | PASS | deployment READY |
| Authorized UI verification | PASS | closed Incident + chronological real timeline visible |

## REMAINING KNOWN ISSUES

- Supabase remote migration-history ledger was empty even though the schema exists; the exact additive migration was applied without destructive reset. Migration-history reconciliation is still required.
- Playback/media hostname hardening remains unverified across all production hostnames.
- No cross-camera correlation or Re-ID is implemented, intentionally.
- Inactivity-based automatic Incident closure and a broad Alert decision layer remain future work.
- Historical legacy incident/correlation data was not bulk migrated.

## PUSH 7 READINESS

**ARE WE READY FOR PUSH 7 — EVIDENCE PRODUCTION VERIFICATION / HARDENING? YES.**

The canonical Incident layer now references original real Event evidence without duplication, while the remaining playback/hostname and retention/access verification are explicitly isolated for PUSH 7.
