export function cleanSyntheticLabel(value?: string | null, fallback = "") {
  const raw = String(value ?? fallback).replace(/\[demo\]/gi, "").trim();
  const canonicalQaLabels: Array<[RegExp, string]> = [
    [/^QA Garden A$/i, "גן השקד"],
    [/^QA Garden B$/i, "גן הפרחים"],
    [/^QA Garden C$/i, "גן השמש"],
    [/^QA A1$/i, "פרפרים א׳"],
    [/^QA A2$/i, "פרפרים ב׳"],
    [/^QA B1$/i, "דבורים א׳"],
    [/^QA B2$/i, "דבורים ב׳"],
    [/^QA Child A$/i, "נועה לוי"],
    [/^QA Child B$/i, "אורי לוי"],
    [/^QA Child C$/i, "מיה לוי"],
    [/^QA Staff A$/i, "מיכל לוי"],
    [/^QA Staff B$/i, "חן כהן"],
    [/^QA Staff AB(?: A| B)?$/i, "שירה אברהם"],
    [/^QA Staff Revoked$/i, "דני מרק"],
    [/^QA Delegated Teacher$/i, "מיכל לוי"],
    [/^QA Parent Unassigned$/i, "דני כהן"],
    [/^QA Parent A$/i, "דנה כהן"],
    [/^QA Parent(?:[- ]Multi| AB)?$/i, "נועה כהן"],
    [/^QA Owner(?:[- ]AB| A| B)?$/i, "דנה כהן"],
    [/^QA Manager(?:[- ]?[AB])?$/i, "דנה כהן"],
    [/^GB-M35 QA pickup allowed$/i, "דנה כהן"],
    [/^GB-M35 QA pickup revoked$/i, "רוני לוי"],
    [/^QA City$/i, "תל אביב"],
    [/^UX\s*0?2 Garden(?: \d+)?$/i, "גן השמש"],
    [/^toddlers$/i, "פעוטות"],
    [/^infants$/i, "תינוקייה"],
    [/^preschool$/i, "בוגרים"],
    [/^teacher$/i, "גננת"],
    [/^assistant$/i, "סייעת"],
    [/^nurse$/i, "אחות"],
  ];
  const matched = canonicalQaLabels.find(([pattern]) => pattern.test(raw));
  return matched?.[1] ?? (raw || fallback);
}

export function isSyntheticLabel(value?: string | null) {
  return /\[demo\]/i.test(String(value ?? ""));
}
