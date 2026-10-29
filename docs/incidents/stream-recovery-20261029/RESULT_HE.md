# המשך טיפול בשידור — 29.10.2026

היעד פתוח: צפייה בנגן המוצר טרם שוחזרה. עבודה בענף `codex/stream-recovery-diagnostics-20261029`, על בסיס תיעוד `3f57700b`. הוראת הבעלים בתור ההמשך: ״לא לעצור את הטיפול והפיתוח עד שהשידור חוזר״. הגבולות המקוריים כוללים איסור DB קיים, Production ופקודות פיזיות; לפיכך גישה למסד QA הקיים תלויה בחריגה מפורשת שהתבקשה בנפרד.

## הוכחה חדשה

כלי QA חדש `scripts/qa/check-cached-relay-decode.py` קורא רק את מקטעי HLS שכבר נוצרו ב־temp של הרכיבים המקומיים. הוא אינו פונה למצלמות/מקליט/HTTP, אינו מפעיל relay, אינו קורא סודות ואינו שומר תמונות או וידאו. הוא דורש inventory של עשרה ערוצי DVR (1–8,10,11) ו־Tapo אחד, בשתי דגימות; latest segment טרי עד 15 שניות, שינוי בתוכן והתקדמות sequence או generation. FFmpeg מקבל את הבתים דרך stdin בלבד עם `-protocol_whitelist pipe`, מפענח שתי תמונות ומחזיר hashes בלבד. מסלולי קבצים אינם נמסרים לפענח.

`cached-decode.json`: PASS 10/10 DVR ו־1/1 Tapo, שתי תמונות מפוענחות לכל מקור והתקדמות בין דגימות בהפרש 15 שניות. זו הוכחת פלט מקומי מתקדם ומפוענח, לא Product playback, הרשאות משתמש, יציבות 24h או AI. אין שיתוף מדיה, אין stream URL או credential בדוח.

`cached-decode-repeat.json`: גם חזרה עצמאית בהפרש 30 שניות עברה 10/10 DVR ו־1/1 Tapo. שתי הריצות אינן soak ארוך ואינן מוכיחות נגן משתמש.

חמש בדיקות גבולות עברו: קישור סימבולי בקובץ/הורה נדחה, גודל מוגבל, URI רשת/מעבר תיקייה/פרמטרים ברשימת HLS נדחים, מקטע חסר אינו PASS, פענוח משתמש בפרוטוקול pipe בלבד. מקטע שנמחק/משתנה במהלך rollover נשאר unproven. זה כלי קריאה לתיקיות QA של משתמש מקומי מהימן; אינו חולץ ארכיון או גבול אבטחה מול תוקף בעל הרשאת כתיבה באותה תיקייה.

פקודות:

```
python3 scripts/qa/check-cached-relay-decode.test.py
python3 scripts/qa/check-cached-relay-decode.py --output docs/incidents/stream-recovery-20261029/cached-decode.json
python3 scripts/qa/check-cached-relay-decode.py --interval 30 --output docs/incidents/stream-recovery-20261029/cached-decode-repeat.json
```

## אבחון שכבות ומצב בעלות

ב־07:14:56 UTC health Gateway 101 דיווח 10/10 מתקדמים, authorization ready, אך כל עשרת encoders היו libx264 עם stdin backpressure. event-loop max היה 23,119ms; relay lifecycle הציג 36 cold output-rescues בכ־9 דקות. אין להסיק מכך תקלה פיזית במקליט: מונה input נמדד בעת הזנה ל־stdin של הפענח, ולכן backpressure של הפענח יכול לעכב קריאת upstream. ב־07:18:48 UTC hardware self-test של runtime היה PASS עם חמישה מקורות ב־cooldown, בעוד כל עשרת בעלי ה־relay עדיין software. Tapo היה copy ו־1/1. CPU מצרפי של 11 ffmpeg processes באותה דגימה: כ־154.3%, RSS כ־194 MiB; אין בכך לבדו הוכחת מיצוי CPU או root cause.

בדיקת hardware סינתטית עצמאית ללא מצלמה/קובץ מקור: בסנדבוקס hardware_self_test_failed; באותה בדיקה מחוץ לסנדבוקס synthetic_hevc_to_h264_passed. אין להציג את תוצאת הסנדבוקס כאי־זמינות hardware במוצר. לא שונו runtime, cooldown, decoder או encoder.

הצ׳אט `01a18678-402a-7802-b9f7-ec3e8c2ebee6` החזיק בבעלות אבחון ה־runtime וסיים עד קומיט `713964b3`; עבודתו נקראה ולא שוכפלו התקנה/תיקון TLS/רישומי שירות. שום שירות לא הופעל מחדש בתור הנוכחי. שידורי QA כבר היו מתקדמים לפני הכלי החדש; הכלי אינו הגורם לחזרתם.

## חסם הצפייה והצעד המוגדר

ב־TLS wrapper מ־8930486e, createPush38tIngress נבנה בלי remoteSession/result token; routes של remote playback מחזירים 404 במכוון. החזרת TLS/auth אינה יוצרת viewer session. כלי הנפקת phone-session הקיים קורא את מסד HOME_QA הקיים ואת ההרשאה הקיימת, ומנפיק JWT ל־20 דקות; זה חורג מאיסור DB קיים של יחידה זו. הוא גם מיועד למארח HTTPS חיצוני/טלפון; אין להריצו כקיצור דרך לצפייה מקומית או לפתוח חשיפה ציבורית.

המשך המוכן לאישור: קריאה בלבד של HOME_QA המקומי, אימות tenant/site/source/enrollment הקיימים ללא שינוי mapping/roles, והנפקת viewer session ל־20 דקות. לנגן מקומי יש להשתמש בחוזה local DEVELOPMENT הקיים, ולא להתיר loopback בנגן remote או לשנות Production identity. לפני הפעלה: לאמת שכל endpoint/DB הוא HOME_QA, שה־grant מוגבל ל־source/site/gateway, שאין refresh identity/OTA, ושה־origin תואם. כתובת ה־local claim מותרת בקוד רק ב־NODE_ENV=development; בניית serve-build ב־production mode אינה מספיקה. אין לעקוף TLS, browser security warning או בקרות grant כדי לקבל תמונה.

לאחר קבלת חריגת HOME_QA, יש לבדוק תחילה read-only availability/auth/metadata ולבחור את תצורת ה־Development המקומית הנתמכת; אם נדרש שינוי runtime/תצורה מעבר לסשן, להכין ולבדוק מועמד נפרד עם rollback לפני החלה. עד אז לא נעשה שימוש במסד קיים ולא נוצר סשן. אין בקשה למפתח age או פעולה פיזית בבית.

## שימור, עלות ומסירה

קוד QA בלבד; ללא שינוי מוצר, סכמות, ספקים, services, source mapping או Production. אין תהליך חדש מתמשך ואין מדיה מיוצאת. buffers מוגבלים ל־8 MiB למקטע; פענוח סדרתי, עד 8 שניות לכל מקור, והמתנה מוגבלת של 5–30 שניות בין שתי דגימות. אין עדות חדשה לעלות הפרויקט הכוללת ואין טענת עמידה בתקרה מכוח אפס ספקים חדשים.

ניסיון העברת אבחון חדש לצ׳אט האפיון נחסם ב־automatic approval review בגלל פירוט תפעולי פנימי ואי־הכרה באישור למסירת payload חדש. לא בוצעה עקיפה או מסירה לצ׳אט חלופי. הבעלים התבקש לאשר במפורש מסירת ממצאים חדשים ל״אפיון מערכת תצפיתן 3״; האבחון הלא תלוי המשיך. עד אישור זו מסירה חסומה, ולא כשל באבחון.

הקומיט מקומי בענף מבודד; push ו־integration pending ללא שינוי main. PUSH38 NOT DONE. פעולת rollback לכלי: revert של קומיט הכלי בלבד; אין שינוי פעיל שיש לבטל.
