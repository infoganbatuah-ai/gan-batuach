export type NotificationChannel = "in_app" | "email" | "sms" | "whatsapp" | "push";

export type NotificationTemplateDefinition = {
  key: string;
  role: "parent" | "manager" | "staff" | "inspector" | "admin";
  channels: NotificationChannel[];
  title: string;
  body: string;
  variables: string[];
  providerRequirements: string[];
  enabled: boolean;
  testModeSupport: boolean;
};

export const notificationTemplateRegistry: NotificationTemplateDefinition[] = [
  {
    key: "manager_approved",
    role: "manager",
    channels: ["in_app", "email"],
    title: "הגן אושר להמשך רישום",
    body: "הבקשה עבור {{kindergarten_name}} אושרה. השלב הבא הוא השלמת פרטי המנוי.",
    variables: ["kindergarten_name"],
    providerRequirements: ["EMAIL_PROVIDER", "EMAIL_MODE"],
    enabled: true,
    testModeSupport: true
  },
  {
    key: "subscription_payment_required",
    role: "manager",
    channels: ["in_app", "email", "whatsapp"],
    title: "יש להשלים תשלום מנוי",
    body: "המנוי של {{kindergarten_name}} ממתין להסדרת תשלום. לא יבוצע חיוב ללא פעולה מאושרת.",
    variables: ["kindergarten_name"],
    providerRequirements: ["PAYMENT_PROVIDER", "PAYMENT_MODE"],
    enabled: true,
    testModeSupport: true
  },
  {
    key: "demo_expiring",
    role: "manager",
    channels: ["in_app", "email", "sms", "whatsapp", "push"],
    title: "תקופת הדמו עומדת להסתיים",
    body: "נותרו {{days_remaining}} ימים לדמו של {{kindergarten_name}}. ניתן להסדיר מנוי מתוך המערכת.",
    variables: ["kindergarten_name", "days_remaining"],
    providerRequirements: ["COMMUNICATIONS_SEND_MODE"],
    enabled: true,
    testModeSupport: true
  },
  {
    key: "kindergarten_frozen",
    role: "manager",
    channels: ["in_app", "email", "sms", "whatsapp"],
    title: "הגן מוקפא עד להסדרת תשלום",
    body: "{{kindergarten_name}} הועבר למצב מוקפא לאחר סיום הדמו ללא תשלום פעיל.",
    variables: ["kindergarten_name"],
    providerRequirements: ["PAYMENT_PROVIDER", "PAYMENT_MODE"],
    enabled: true,
    testModeSupport: true
  },
  {
    key: "parent_invite",
    role: "parent",
    channels: ["email", "sms", "whatsapp"],
    title: "הוזמנת להצטרף לגן",
    body: "{{kindergarten_name}} הזמין אותך לפתוח חשבון הורה בגני בטוח.",
    variables: ["kindergarten_name"],
    providerRequirements: ["COMMUNICATIONS_SEND_MODE"],
    enabled: true,
    testModeSupport: true
  },
  {
    key: "enrollment_request_approved",
    role: "parent",
    channels: ["in_app", "email", "push"],
    title: "בקשת הרישום אושרה",
    body: "בקשת הרישום עבור {{child_name}} אושרה על ידי {{kindergarten_name}}.",
    variables: ["child_name", "kindergarten_name"],
    providerRequirements: ["EMAIL_PROVIDER", "PUSH_PROVIDER"],
    enabled: true,
    testModeSupport: true
  },
  {
    key: "staff_application_approved",
    role: "staff",
    channels: ["in_app", "email", "push"],
    title: "המועמדות שלך אושרה",
    body: "{{kindergarten_name}} אישר את המועמדות שלך. אפשר להמשיך למסך הצוות.",
    variables: ["kindergarten_name"],
    providerRequirements: ["EMAIL_PROVIDER", "PUSH_PROVIDER"],
    enabled: true,
    testModeSupport: true
  },
  {
    key: "inspector_assigned",
    role: "inspector",
    channels: ["in_app", "email", "push"],
    title: "שויכו אליך גנים לביקורת",
    body: "שויכו אליך {{kindergarten_count}} גנים. ניתן לראות אותם במסך המפקח.",
    variables: ["kindergarten_count"],
    providerRequirements: ["EMAIL_PROVIDER", "PUSH_PROVIDER"],
    enabled: true,
    testModeSupport: true
  },
  {
    key: "payment_failed",
    role: "manager",
    channels: ["in_app", "email", "sms", "whatsapp"],
    title: "התשלום נכשל",
    body: "לא הצלחנו להשלים את תשלום המנוי של {{kindergarten_name}}. ניתן לנסות שוב מתוך המערכת.",
    variables: ["kindergarten_name"],
    providerRequirements: ["PAYMENT_PROVIDER", "PAYMENT_MODE"],
    enabled: true,
    testModeSupport: true
  },
  {
    key: "invoice_failed",
    role: "admin",
    channels: ["in_app", "email"],
    title: "הפקת חשבונית נכשלה",
    body: "נדרש טיפול ידני באירוע החשבונית {{invoice_event_id}}.",
    variables: ["invoice_event_id"],
    providerRequirements: ["INVOICE_PROVIDER", "INVOICE_MODE"],
    enabled: true,
    testModeSupport: true
  }
];
