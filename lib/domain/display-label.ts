export function cleanSyntheticLabel(value?: string | null, fallback = "") {
  return String(value ?? fallback).replace(/\[demo\]/gi, "").trim() || fallback;
}

export function isSyntheticLabel(value?: string | null) {
  return /\[demo\]/i.test(String(value ?? ""));
}
