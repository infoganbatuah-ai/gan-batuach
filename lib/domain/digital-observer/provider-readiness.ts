export type DigitalObserverProviderMode = "disabled" | "readiness" | "sandbox_pending";

export type DigitalObserverReadinessChannel = {
  key: "in_app" | "push" | "email" | "sms" | "whatsapp" | "voice";
  label: string;
  mode: DigitalObserverProviderMode;
  userPreference: "enabled_in_app" | "optional" | "disabled_until_provider";
  templateKeys: string[];
  routing: string;
  historyState: string;
  activationGate: string;
};

export type DigitalObserverEmergencyStep = {
  order: number;
  title: string;
  status: "ready_for_policy" | "requires_human_confirmation" | "blocked_external";
  detail: string;
};

export const DIGITAL_OBSERVER_AI_SHADOW_READINESS = {
  status: "shadow_readiness",
  liveAnalysisEnabled: false,
  acceptsLiveMedia: false,
  acceptsEventMetadata: true,
  acceptsSyntheticMedia: true,
  consentRequired: true,
  providerRequiredForInference: true,
  reviewRequiredBeforeAction: true,
  summary:
    "מנוע AI Shadow מוכן לקבל אירוע, metadata או מדיה סינתטית לבדיקה. הוא אינו מפעיל ניתוח חי, אינו מושך וידאו ואינו מסיק מסקנות בלי ספק מאושר והסכמה.",
  supportedInputs: ["event_metadata", "synthetic_frame", "approved_test_clip"],
  blockedInputs: ["live_camera_stream", "raw_rtsp", "dvr_credentials", "unapproved_child_media"],
  reviewStatuses: ["queued", "needs_review", "reviewing", "confirmed", "dismissed", "false_alarm", "escalated"]
} as const;

export const DIGITAL_OBSERVER_ALERT_CHANNELS: DigitalObserverReadinessChannel[] = [
  {
    key: "in_app",
    label: "בתוך האפליקציה",
    mode: "readiness",
    userPreference: "enabled_in_app",
    templateKeys: ["event_needs_review", "false_alarm_acknowledged", "subscription_status_changed"],
    routing: "נרשם במרכז ההתראות בלבד",
    historyState: "נשמר כהיסטוריית פעולה פנימית",
    activationGate: "זמין ללא ספק חיצוני"
  },
  {
    key: "push",
    label: "Push",
    mode: "sandbox_pending",
    userPreference: "disabled_until_provider",
    templateKeys: ["critical_event_push", "camera_offline_push"],
    routing: "מוכן ל-FCM/APNs/Web Push בעתיד",
    historyState: "נרשם כהדמיית מסירה ללא הודעה",
    activationGate: "דורש אפליקציה, device token, opt-in ובדיקת Sandbox"
  },
  {
    key: "email",
    label: "דוא״ל",
    mode: "sandbox_pending",
    userPreference: "optional",
    templateKeys: ["event_review_email", "billing_notice_email"],
    routing: "מוכן לתור ספק מייל קיים",
    historyState: "נרשם כ-mock עד הפעלה מפורשת",
    activationGate: "דורש תבניות מאושרות ומצב שליחה מאושר"
  },
  {
    key: "sms",
    label: "SMS",
    mode: "disabled",
    userPreference: "disabled_until_provider",
    templateKeys: ["urgent_event_sms", "billing_retry_sms"],
    routing: "מסלול ניתוב מוגדר אך חסום",
    historyState: "אין שליחה; ניתן לשמור ניסיון בדיקה פנימי",
    activationGate: "דורש ספק SMS, מכסות, opt-in והודעת בדיקה"
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    mode: "disabled",
    userPreference: "disabled_until_provider",
    templateKeys: ["urgent_event_whatsapp", "setup_reminder_whatsapp"],
    routing: "מסלול תבניות מוכן ללא ספק",
    historyState: "אין שליחה; אין פתיחת שיחה",
    activationGate: "דורש חשבון WhatsApp Business, תבניות מאושרות והסכמה"
  },
  {
    key: "voice",
    label: "שיחה",
    mode: "disabled",
    userPreference: "disabled_until_provider",
    templateKeys: ["human_operator_callback", "site_owner_confirmation_call"],
    routing: "מוכן לשיחת אישור אנושית בלבד",
    historyState: "אין חיוג; נשמרת בקשת הסלמה פנימית",
    activationGate: "דורש ספק טלפוניה, מספר מאושר ונוהל אנושי"
  }
];

export const DIGITAL_OBSERVER_BILLING_READINESS = {
  liveBillingEnabled: false,
  collectPaymentMethodEnabled: false,
  providerMode: "readiness" as const,
  catalogSource: "observer_monitoring_packages",
  accountStates: ["setup", "trial", "pending_payment", "active", "overdue", "suspended", "cancelled"],
  safeActions: ["select_plan_request", "change_plan_request", "record_mock_invoice", "view_entitlement_status"],
  blockedActions: ["charge_card", "create_live_checkout", "send_invoice_to_customer", "start_app_store_purchase"],
  activationGate: "בחירת ספק סליקה/חנויות, תנאים משפטיים, Webhooks מאומתים ואישור משתמש נפרד"
} as const;

export const DIGITAL_OBSERVER_EMERGENCY_POLICY = {
  automaticEmergencyAuthorityCallsEnabled: false,
  emergencyServicesDialingAllowed: false,
  humanConfirmationRequired: true,
  falseAlarmFlowRequired: true,
  verifiedAddressRequired: true,
  approvedVoiceProviderRequired: true,
  steps: [
    {
      order: 1,
      title: "זיהוי אירוע לבדיקה",
      status: "ready_for_policy",
      detail: "AI או כלל ניטור יכולים לפתוח אירוע לבדיקה בלבד, ללא פעולה חיצונית."
    },
    {
      order: 2,
      title: "אישור או ביטול על ידי אדם מורשה",
      status: "requires_human_confirmation",
      detail: "בעל האתר או מורשה עדכונים מאשר אירוע, מסמן התרעת שווא או מבקש המשך טיפול."
    },
    {
      order: 3,
      title: "ניתוב למורשי עדכונים",
      status: "blocked_external",
      detail: "Push, SMS, WhatsApp ושיחה יישארו כבויים עד חיבור ספקים והסכמה."
    },
    {
      order: 4,
      title: "שיחה אנושית בלבד",
      status: "blocked_external",
      detail: "גם בעתיד, שיחת חירום מיועדת לאישור אנושי מול אנשי קשר. אין חיוג אוטומטי לגורמי חירום."
    }
  ] satisfies DigitalObserverEmergencyStep[]
} as const;

export function getDigitalObserverProductReadiness() {
  const enabledChannels = DIGITAL_OBSERVER_ALERT_CHANNELS.filter((channel) => channel.mode === "readiness").length;
  const providerBlockedChannels = DIGITAL_OBSERVER_ALERT_CHANNELS.length - enabledChannels;

  return {
    ai: DIGITAL_OBSERVER_AI_SHADOW_READINESS,
    alertChannels: DIGITAL_OBSERVER_ALERT_CHANNELS,
    billing: DIGITAL_OBSERVER_BILLING_READINESS,
    emergency: DIGITAL_OBSERVER_EMERGENCY_POLICY,
    summary: {
      enabledChannels,
      providerBlockedChannels,
      liveActionsBlocked: true,
      externalProviderAgnostic: true,
      safeToDemoWithoutProviders: true
    }
  };
}
