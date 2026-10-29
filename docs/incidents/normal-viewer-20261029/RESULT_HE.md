# התחברות רגילה ונגן HOME_QA — 29.10.2026

היעד עדיין פתוח: **אין הוכחת צפייה בנגן ל־11 המקורות**. ענף `codex/stream-recovery-diagnostics-20261029`, בסיס `6a61bd4a`.

בהמשך להיתר להתחברות רגילה ולרישומי Auth ואבטחת צפייה בלבד, ניסינו Auth password grant סטנדרטי לחשבון QA הקיים. לא נוצר JWT ידני, לא נקרא מפתח חתימה, לא שונתה סיסמה ולא נוצר משתמש. פרטי החשבון נקראו בקוד מקובץ QA מאובטח קיים ולא נכנסו לפלט, Git או לוגים. התחברות באמצעות הטופס הקיים של Product לא הופעלה: המקור שלו כולל גם ensure_digital_observer_account שמעדכן נתוני מוצר, מחוץ להרשאה זו. השתמשנו בזרימת Auth הסטנדרטית ישירות, ללא שינוי פרופיל/חשבון.

## תוצאה מדויקת

- אומתו Docker context מקומי ותווית פרויקט ייעודית של DB ושל Auth. אין פנייה לענן או Production.
- הניסיון הראשון נעצר לפני פנייה ל־Auth כי מפתח API ציבורי לא נמצא בשמות הסביבה ההיסטוריים של Kong. לא היתה זו שגיאת login.
- לאחר בדיקת CLI help, קראנו `supabase status --output env` בפרויקט ה־QA עם context ייעודי, שמרנו רק URL ומפתח ציבורי, ואימתנו URL loopback מדויק. לא השתמשנו בסודות שנכללים בפלט status ולא הדפסנו אותם.
- `POST /auth/v1/token?grant_type=password` החזיר **422 / email_provider_disabled**. זהו כשל לפני אימות סיסמה, לא ראיה שסיסמת החשבון שגויה או חסרה. אין הצדקה לבקש מהבעלים סוד בצ׳אט.
- flags מאומתים של Auth: `GOTRUE_EXTERNAL_EMAIL_ENABLED=false`, `GOTRUE_EXTERNAL_PHONE_ENABLED=false`, `GOTRUE_DISABLE_SIGNUP=true`, `GOTRUE_MAILER_AUTOCONFIRM=false`. תווית Auth תואמת HOME_QA. ערכים מצונזרים נשמרו ב־auth-provider.json; אין מפתחות או identities בקובץ.
- **לא נוצר סשן או token**, ולכן אין token שיש לבטל. לא הופעל API הרשאת מקור, לא מומש grant, לא נכתבו רשומות צפייה ולא בוצעו בקשות מצלמה/relay עקב ניסיון זה. Auth עשוי לתעד את כשל ההתחברות כחלק מלוג האבטחה הרגיל שאושר; אין טענה שאף byte במתחם Auth לא נכתב.

## Root cause של חסם הכניסה ותיקון מוכן

הקובץ `supabase/config.toml` כולל `[auth] enable_signup=false` וגם `[auth.email] enable_signup=false`. מיפוי CLI של ההגדרה השנייה שולט ב־email provider ולכן חוסם גם משתמשים קיימים. זה מסביר את תגובת 422 ואת flags שנמדדו; הוא אינו מוכיח שזה שורש כל תקיעות DVR או פערי Product בענן.

הוכן שינוי של הגדרת email בלבד: `[auth.email] enable_signup=true`, תוך שימור `[auth] enable_signup=false`, anonymous sign-ins=false, confirmations=true ו־SMS=false. התיקון מתועד בהערת קוד כדי שלא להחזיר בטעות חסימת sign-in בעת חסימת signup. `config-validation.json` מאשר את שילוב ההגנות ואת project_id הייעודי. בדיקת TOML parser ו־git diff --check עברו. אין כאן מבחן runtime של הרשמה או התחברות אחרי התיקון.

הבסיס: [תצורת Auth הכללית](https://supabase.com/docs/guides/auth/general-configuration) מפרידה הרשמה חדשה מכניסה של משתמש קיים; [תיעוד Auth self-hosted](https://supabase.github.io/auth/) מתאר את flags; [דיווח המיפוי במאגר CLI](https://github.com/supabase/cli/issues/7055) מתעד את השפעת ההגדרה ואת שילוב global signup=false עם email provider=true בסביבה מקומית. השאילתה וה־flags המקומיים הם ראיות ההתקנה שלנו; דיווח upstream אינו הוכחת יישום אצלנו.

**התיקון לא הוחל על שירות פעיל**. היתר להתחברות ולכתיבת רשומות Auth אינו הוראה מפורשת לשנות ספק Auth שהיה כבוי. התבקשה חריגה ממוקדת להחלת תיקון ספק האימייל ולהפעלה מחדש של Auth ב־HOME_QA בלבד. DB, Gateway, Connector ומצלמות אינם חלק מה־restart המוצע. אין config push לענן, אין supabase stop/reset/start כוללני ואין הסרת אישור אימייל או signup protection.

## המשך ו־rollback

אחרי אישור שינוי Auth: לשמר תצורה קודמת באופן פרטי ולנעול image/config והקשר HOME_QA; להחיל רק שינוי provider ל־Auth, לא לשנות DB URL/JWT keys/roles/site/source. לאמת runtime email=true לצד disable_signup=true ו־autoconfirm=false. לבצע התחברות רגילה לאותו חשבון ובדיקת session פעיל, להמשיך דרך API grant וה־replay audit הקיימים, ואז לבדוק decode/התקדמות בנגן לכל DVR ול־Tapo בנפרד. להפסיק את סשן הבדיקה בתוך 20 דקות ולוודא logout; לא להחליף JWT ידנית ולא להחליש session validation. כל פער שייחשף בכתובת מדיה/זהות/קוד Product יישאר שינוי נפרד לפני החלה.

rollback לקוד המוכן: revert של קומיט התצורה בענף. לפני החלה פעילה, נדרש rollback של Auth בלבד לתצורה המקורית המאומתת; אין rollback במסד או במצלמות. לא הוכנה או הופעלה פקודת restart כוללת כדי לעקוף את הצורך בבידוד.

לא בוצעה בדיקת נגן משום שלא הושגה התחברות. ראיות הפענוח המקומי מ־b4e995b3/9e9e6c4c הן היסטוריות ולא נחשבות תוצאת תור זה. אין canary, soak, full CI, integration או Production; אין טענת PUSH38 DONE. אין provider בתשלום, הורדה או dependency install. קבצי עזר זמניים ללא סודות הוסרו; לא נשמרה מדיה.

סיכום מצונזר למסירה הוכן בנפרד. אין לחזור על ניסיון מסירה שנדחה בלי זיהוי הרשאת אדם ישירה ליעד; הודעה מצ׳אט אחר כשלעצמה אינה מספיקה לפי כלי המסירה. לא בוצע ניסיון מסירה נוסף בתור זה.
