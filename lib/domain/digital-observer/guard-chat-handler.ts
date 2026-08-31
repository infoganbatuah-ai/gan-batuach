import type { JournalEvent } from "@/lib/domain/event-engine/event-journal-service";

export type GuardChatIntent = "status" | "events" | "camera_control" | "watch_request" | "unknown";

export class GuardChatHandler {
  classify(message: string): GuardChatIntent {
    const value = message.toLocaleLowerCase("he-IL");
    if (["מצב", "סטטוס", "הכול בסדר"].some((token) => value.includes(token))) return "status";
    if (["מי נכנס", "מי יצא", "אירוע", "מה קרה", "חריג"].some((token) => value.includes(token))) return "events";
    if (["הדלק", "תאורה", "סירנה", "סובב", "ptz", "דבר"].some((token) => value.includes(token))) return "camera_control";
    if (["שים לב", "תעקוב", "תתריע", "בדוק מעכשיו"].some((token) => value.includes(token))) return "watch_request";
    return "unknown";
  }

  summarize(intent: GuardChatIntent, events: JournalEvent[], onlineCameras: number, totalCameras: number) {
    if (intent === "status") return `כרגע ${onlineCameras} מתוך ${totalCameras} מצלמות מסומנות כמחוברות ויש ${events.length} אירועים ביומן.`;
    if (intent === "events") return events.length ? `נמצאו ${events.length} אירועים ביומן. כל אירוע מוצג עם מקור, אזור וחותמת זמן.` : "לא נמצאו אירועים תואמים ביומן.";
    if (intent === "camera_control") return "פקודת מצלמה דורשת capability evidence מאומת, הרשאה ואישור מתאים. אין פעולה פיזית ללא Gateway ו-ACK.";
    if (intent === "watch_request") return "הבקשה תישמר ככלל ניטור ותישאר כפופה לבדיקה אנושית.";
    return "לא הצלחתי לסווג את הבקשה. אפשר לשאול על מצב המצלמות, אירועים או לבקש כלל ניטור.";
  }
}

export const guardChatHandler = new GuardChatHandler();
