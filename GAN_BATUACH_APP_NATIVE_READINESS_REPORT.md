# גן בטוח - מוכנות Web, Android ו-iOS

## Web

- Build: PASS.
- Responsive first load: PASS במסכי QA שנבדקו.
- 9 תפקידים: כניסה אמיתית ו-QA סינתטי.
- סביבת Production אמיתית: לא מאושרת.

## Capacitor

- App ID: `com.ganbatuach.app`.
- App name: `גן בטוח`.
- `npx cap sync`: PASS חוזר ב-20 באוגוסט 2026 לאחר שינויי Web/Auth/Layout.
- תצורה נוכחית: WebView ל-`CAPACITOR_SERVER_URL` או `NEXT_PUBLIC_APP_URL`; fallback מקומי.
- המשמעות: ללא רשת או כאשר האתר אינו זמין, אין bundle אפליקטיבי מלא שממשיך לעבוד.

## Android

- Java 17 זמין.
- Gradle התחיל בהצלחה גם בבדיקה החוזרת ב-20 באוגוסט 2026.
- `assembleDebug` נעצר רק משום ש-Android SDK path חסר (`ANDROID_HOME`/`android/local.properties`).
- Manifest כולל Internet בלבד; Push והרשאות נוספות טרם הוגדרו.
- נדרש Android Studio/SDK, emulator ומכשיר אמיתי.

## iOS

- קיימת תיקיית iOS וסנכרון Capacitor עבר.
- Xcode מלא אינו מותקן/נבחר; בדיקת `xcodebuild -version` נכשלה משום שנבחרים Command Line Tools בלבד.
- אין APNs entitlements/background modes/real-device signing מוכחים.

## חוסמי הפצה

1. Android SDK ו-Debug build.
2. Xcode, Simulator ו-Debug build.
3. החלטת remote WebView מול bundled/offline shell.
4. FCM/APNs אמיתי, deep links ו-token lifecycle.
5. בדיקות safe-area, מקלדת, העלאה, הורדה והרשאות במכשירים אמיתיים.
6. Privacy manifests, store privacy, screenshots, icons, signing ו-beta rollout.

מסקנה: **Web QA יכול להמשיך. Native distribution אינו מוכן ואינו חוסם Pilot Web בלבד.**
