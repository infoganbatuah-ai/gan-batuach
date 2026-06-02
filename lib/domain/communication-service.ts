type SupabaseLike = {
  from: (table: string) => any;
};

export type CommunicationChannel = "in_app" | "sms" | "whatsapp" | "email";
export type CommunicationStatus = "queued" | "sent_mock" | "sent" | "failed" | "delivered" | "read" | "skipped_preferences" | "deduped";

export type CommunicationTemplateKey =
  | "parent_lead_submitted"
  | "parent_approved"
  | "child_profile_needs_completion"
  | "child_approved"
  | "child_rejected"
  | "document_requested"
  | "payment_failed"
  | "payment_due"
  | "daily_update"
  | "request_answered"
  | "new_parent_lead"
  | "child_pending_approval"
  | "parent_request_received"
  | "manager_payment_failed"
  | "subscription_renewal"
  | "camera_issue"
  | "inspection_due"
  | "staff_new_task"
  | "staff_missing_document"
  | "manager_message"
  | "inspection_assigned"
  | "violation_opened"
  | "new_kindergarten_request"
  | "subscription_issue"
  | "system_alert";

type TemplateDefinition = {
  title: string;
  body: string;
};

export type SendCommunicationInput = {
  recipientProfileId: string;
  kindergartenId?: string | null;
  templateKey: CommunicationTemplateKey;
  channels?: CommunicationChannel[];
  variables?: Record<string, string | number | null | undefined>;
  emergency?: boolean;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
};

type CommunicationProviderResult = {
  status: CommunicationStatus;
  provider: string;
  providerMessageId?: string | null;
  failureReason?: string | null;
};

type CommunicationProvider = {
  send: (input: {
    channel: CommunicationChannel;
    recipientPhone?: string | null;
    recipientEmail?: string | null;
    message: string;
    templateKey: string;
    metadata?: Record<string, unknown>;
  }) => Promise<CommunicationProviderResult>;
};

const templates: Record<CommunicationTemplateKey, TemplateDefinition> = {
  parent_lead_submitted: { title: "בקשת ההצטרפות נשלחה", body: "בקשת ההצטרפות לגן התקבלה ונשלחה לאישור." },
  parent_approved: { title: "הגן אישר את בקשת ההצטרפות", body: "הגן אישר את הבקשה. ניתן להתחבר ולהשלים את כרטיס הילד." },
  child_profile_needs_completion: { title: "צריך להשלים את פרטי הילד", body: "נדרש להשלים את כרטיס הילד כדי שהגן יוכל לאשר את הרישום." },
  child_approved: { title: "הילד אושר בגן", body: "כרטיס הילד אושר והילד פעיל בגן." },
  child_rejected: { title: "עדכון מבקשת הרישום", body: "הגן עדכן את סטטוס בקשת הרישום. יש להיכנס למערכת לפרטים." },
  document_requested: { title: "נדרש מסמך", body: "הגן ביקש להשלים מסמך עבור הילד." },
  payment_failed: { title: "תשלום לא עבר", body: "הגן סימן שתשלום לא עבר ויש צורך בבדיקה." },
  payment_due: { title: "תשלום קרוב", body: "יש תשלום קרוב עבור הגן." },
  daily_update: { title: "עדכון חדש מהגן", body: "יש עדכון חדש לגבי היום של הילד." },
  request_answered: { title: "הפנייה שלך נענתה", body: "הגן השיב לפנייה שלך." },
  new_parent_lead: { title: "בקשת הצטרפות חדשה", body: "התקבלה בקשת הצטרפות חדשה מגן/הורה." },
  child_pending_approval: { title: "ילד ממתין לאישור", body: "הורה השלים כרטיס ילד שממתין לאישור הגן." },
  parent_request_received: { title: "פניית הורה חדשה", body: "התקבלה פנייה חדשה מהורה." },
  manager_payment_failed: { title: "תשלום לא עבר", body: "תשלום סומן כלא עבר וממתין לטיפול." },
  subscription_renewal: { title: "חידוש מנוי מתקרב", body: "מועד חידוש המנוי מתקרב." },
  camera_issue: { title: "מצלמה דורשת בדיקה", body: "אחת המצלמות אינה מחוברת או דורשת טיפול." },
  inspection_due: { title: "פיקוח מתקרב", body: "ביקורת/פיקוח מתקרבים ויש להיערך." },
  staff_new_task: { title: "משימה חדשה", body: "הוקצתה לך משימה חדשה." },
  staff_missing_document: { title: "חסר מסמך", body: "נדרש להשלים מסמך צוות." },
  manager_message: { title: "הודעה מהמנהלת", body: "התקבלה הודעה חדשה מהגן." },
  inspection_assigned: { title: "ביקורת חדשה שובצה", body: "שובצה לך ביקורת חדשה." },
  violation_opened: { title: "ליקוי חדש נפתח", body: "נפתח ליקוי חדש למעקב." },
  new_kindergarten_request: { title: "בקשת גן חדשה", body: "התקבלה בקשה חדשה לצירוף גן." },
  subscription_issue: { title: "בעיית מנוי", body: "זוהתה בעיית מנוי שדורשת בדיקה." },
  system_alert: { title: "התראת מערכת", body: "אירוע מערכת דורש בדיקה." }
};

const mockProvider: CommunicationProvider = {
  async send(input) {
    return {
      status: "sent_mock",
      provider: `mock_${input.channel}`,
      providerMessageId: `mock_${input.channel}_${Date.now()}`
    };
  }
};

const unimplementedRealProvider: CommunicationProvider = {
  async send(input) {
    return {
      status: "failed",
      provider: `real_${input.channel}`,
      failureReason: "Real communication provider adapter is not implemented yet."
    };
  }
};

export function normalizeIsraeliPhone(input?: string | null) {
  if (!input) return null;
  const trimmed = input.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+972")) {
    const local = digits.replace(/^972/, "");
    return /^5\d{8}$/.test(local) ? `+972${local}` : null;
  }
  if (/^9725\d{8}$/.test(digits)) return `+${digits}`;
  if (/^05\d{8}$/.test(digits)) return `+972${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `+972${digits}`;
  return null;
}

export function maskPhone(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 4) return "***";
  return `${phone.startsWith("+") ? "+" : ""}***${digits.slice(-4)}`;
}

function getProvider(channel: CommunicationChannel): CommunicationProvider {
  const mode = process.env.COMMUNICATION_PROVIDER || "mock";
  if (mode !== "real") return mockProvider;
  if (channel === "sms" && process.env.SMS_PROVIDER && process.env.SMS_API_KEY) return unimplementedRealProvider;
  if (channel === "whatsapp" && process.env.WHATSAPP_PROVIDER && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) return unimplementedRealProvider;
  if (channel === "email" && process.env.EMAIL_PROVIDER && process.env.EMAIL_API_KEY) return unimplementedRealProvider;
  return mockProvider;
}

function renderTemplate(templateKey: CommunicationTemplateKey, variables?: SendCommunicationInput["variables"]) {
  const template = templates[templateKey];
  const suffixParts = Object.entries(variables ?? {})
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .slice(0, 4)
    .map(([, value]) => String(value));
  const suffix = suffixParts.length ? ` (${suffixParts.join(" · ")})` : "";
  return {
    title: template.title,
    message: `${template.body}${suffix}`
  };
}

function channelAllowed(channel: CommunicationChannel, preferences: any, emergency?: boolean) {
  if (channel === "in_app") return true;
  if (!preferences) return true;
  if (emergency && preferences?.emergency_messages_allowed !== false) return true;
  if (channel === "sms") return preferences?.receive_sms === true;
  if (channel === "whatsapp") return preferences?.receive_whatsapp === true;
  if (channel === "email") return preferences?.receive_email !== false;
  return false;
}

async function insertLog(
  supabase: SupabaseLike,
  input: SendCommunicationInput,
  channel: CommunicationChannel,
  status: CommunicationStatus,
  message: string,
  provider: string,
  recipientPhone?: string | null,
  recipientEmail?: string | null,
  providerMessageId?: string | null,
  failureReason?: string | null,
  dedupeKey?: string | null
) {
  return supabase.from("communication_logs").insert({
    recipient_profile_id: input.recipientProfileId,
    kindergarten_id: input.kindergartenId ?? null,
    channel,
    template_key: input.templateKey,
    recipient_phone: recipientPhone ?? null,
    recipient_email: recipientEmail ?? null,
    message_preview: message.slice(0, 500),
    status,
    provider,
    provider_message_id: providerMessageId ?? null,
    failure_reason: failureReason ?? null,
    sent_at: status === "sent" || status === "sent_mock" ? new Date().toISOString() : null,
    metadata: input.metadata ?? {},
    dedupe_key: dedupeKey
  });
}

export async function sendCommunication(supabase: SupabaseLike, input: SendCommunicationInput) {
  const channels = input.channels?.length ? input.channels : (["in_app"] as CommunicationChannel[]);
  const { message } = renderTemplate(input.templateKey, input.variables);
  const { data: recipient, error: recipientError } = await supabase
    .from("profiles")
    .select("id, email, phone")
    .eq("id", input.recipientProfileId)
    .maybeSingle();

  if (recipientError || !recipient) {
    return {
      ok: false,
      error: recipientError?.message ?? "recipient_not_found",
      logs: [] as Array<{ channel: CommunicationChannel; status: CommunicationStatus }>
    };
  }

  const { data: preferences } = await supabase
    .from("communication_preferences")
    .select("*")
    .eq("profile_id", input.recipientProfileId)
    .maybeSingle();

  const logs: Array<{ channel: CommunicationChannel; status: CommunicationStatus; error?: string | null }> = [];
  for (const channel of channels) {
    const channelDedupeKey = input.dedupeKey ? `${input.dedupeKey}:${channel}` : null;
    if (channelDedupeKey) {
      const existing = await supabase.from("communication_logs").select("id, status").eq("dedupe_key", channelDedupeKey).maybeSingle();
      if (existing.data) {
        logs.push({ channel, status: "deduped" });
        continue;
      }
    }

    if (!channelAllowed(channel, preferences, input.emergency)) {
      const skipped = await insertLog(supabase, input, channel, "skipped_preferences", message, "preferences", null, recipient.email, null, "User communication preferences do not allow this channel.", channelDedupeKey);
      logs.push({ channel, status: "skipped_preferences", error: skipped.error?.message ?? null });
      continue;
    }

    const normalizedPhone = normalizeIsraeliPhone(recipient.phone);
    if ((channel === "sms" || channel === "whatsapp") && !normalizedPhone) {
      const failed = await insertLog(supabase, input, channel, "failed", message, "validation", null, recipient.email, null, "Missing or invalid phone number.", channelDedupeKey);
      logs.push({ channel, status: "failed", error: failed.error?.message ?? null });
      continue;
    }

    if (channel === "email" && !recipient.email) {
      const failed = await insertLog(supabase, input, channel, "failed", message, "validation", normalizedPhone, null, null, "Missing email address.", channelDedupeKey);
      logs.push({ channel, status: "failed", error: failed.error?.message ?? null });
      continue;
    }

    const provider = getProvider(channel);
    const result = await provider.send({
      channel,
      recipientPhone: normalizedPhone,
      recipientEmail: recipient.email,
      message,
      templateKey: input.templateKey,
      metadata: input.metadata
    });
    const inserted = await insertLog(
      supabase,
      input,
      channel,
      result.status,
      message,
      result.provider,
      normalizedPhone,
      recipient.email,
      result.providerMessageId,
      result.failureReason,
      channelDedupeKey
    );
    logs.push({ channel, status: result.status, error: inserted.error?.message ?? result.failureReason ?? null });
  }

  return { ok: logs.every((log) => !log.error), logs };
}
