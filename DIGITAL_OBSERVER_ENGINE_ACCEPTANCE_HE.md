# מסמך קבלה — Digital Guard Engine

עודכן: 2026-08-31

## כלל ארכיטקטוני מחייב

| דרישה | מצב | ראיה |
|---|---|---|
| STANDARD משתמש במנוע ביומטרי/יכולות רגילות | מוכן ברמת החוזה | `lib/domain/observer-engine/router.ts`, `biometric-engine.ts` |
| KINDERGARTEN משתמש רק בשלד ותנוחה | מוכן ברמת החוזה | `skeleton-engine.ts`, `policy.ts` |
| בחירת מנוע לפי טננט ולא לפי UI | מוכן | `processFrameForCamera` |
| raw frame אסור בגן בטוח | מוכן | `prepareKindergartenFrame` |
| Face ID, embeddings, פנים ו־LPR נחסמים בגן בטוח | מוכן | `assertKindergartenPayload`, `assertKindergartenEvent` |

## מודלים, מצלמות ויכולות

| דרישה | מצב | ראיה / חסם |
|---|---|---|
| CameraDevice ו־CameraCapabilityManifest | מוכן | `lib/domain/digital-observer/guard-engine.ts` |
| גילוי PTZ, שמע דו־כיווני, סירנה ותאורה | מוכן לפי metadata/Gateway evidence | `discoverCameraCapabilities` |
| API לגילוי יכולות | מוכן | `app/api/digital-observer/camera-capabilities/route.ts` |
| UI להצגת היכולות | מוכן | `observer-capability-panel.tsx` |
| גילוי חומרה אמיתי לכל יצרן | חסום חיצונית | נדרש Gateway/ONVIF או SDK יצרן שמחזיר capability manifest חתום |
| הפעלה פיזית של PTZ/תאורה/סירנה/אודיו | חסום עד Adapter אמיתי | ללא Adapter פקודות ו־ACK אמיתי ה־API מחזיר 503 ואינו טוען שהפעולה נמסרה |
| Audit לכל ניסיון פעולה | מוכן ברמת האפליקציה | `writeCameraAccessEvent` מופעל גם בדחייה |
| אישור אנושי לפני אודיו/סירנה | מוכן | `camera-actions/route.ts` |

## אירועים, למידה וצ׳אט

| דרישה | מצב | ראיה / חסם |
|---|---|---|
| Event Journal מנורמל ומקובץ | מוכן | `lib/domain/event-engine/event-journal-service.ts` |
| אימות אירוע לפי אזור | מוכן | `event-validation-pipeline.ts`, `camera-zone-mapper.ts` |
| חיבור Event Log לצ׳אט | מוכן | `app/api/digital-observer/conversation/route.ts` מחזיר `event_log` |
| כללי ניטור ולמידת בסיס | קיים ברמת מוצר | טבלאות `observer_watch_requests`, `site_behavior_baselines` |
| זיהוי אנומליה חי | חסום חיצונית | נדרש stream של פריימים/אירועים ממודל AI מאושר |
| ביומטריה/LPR ב־STANDARD בלבד ובהסכמה | חלקי | חסמי API קיימים; ספק inference, consent evidence ו־retention דורשים הפעלה חיצונית |

## בטיחות ואסקלציה

| דרישה | מצב | ראיה / חסם |
|---|---|---|
| Fire/Smoke, intrusion, pool hazard | חוזים וכללי אירועים קיימים | נדרש מודל vision מחובר ל־Gateway כדי להוכיח זיהוי חי |
| התראה ובדיקה אנושית | מוכן ברמת המוצר | `observer_intelligence_signals`, chat/watch routes |
| חיוג/dispatch אוטומטי | חסום בכוונה | נדרש ספק חירום מאושר, הרשאת חשבון, מדיניות override ואישור משפטי/תפעולי |
| אין פעולה אוטומטית מסוכנת | מוכן | פעולות רגישות דורשות אישור וה־API מחזיר `executed: false` עד ACK |

## תוצאות אימות

- `npx tsc --noEmit --pretty false` עבר ללא שגיאה.
- `git diff --check` עבר ללא שגיאה.
- `npm run build` התחיל, אך נשאר ללא פלט בשלב יצירת חבילת production ונעצר ידנית לאחר המתנה ממושכת; אין כאן ראיית build מלא שעבר.
- E2E חי, Gateway אמיתי, ספקי AI ו־dispatch לא ניתנים להוכחה בסביבת העבודה ללא credentials וחיבורים חיצוניים.

## שער שחרור

המערכת אינה יכולה לקבל סטטוס Production Ready עבור פעולה פיזית או זיהוי חי עד לקבלת ראיות חיצוניות: Gateway מחובר עם capability manifest, command ACK, ספקי inference מאושרים, audit log, ובדיקת E2E בסביבת production.
