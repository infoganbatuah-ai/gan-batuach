"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, MapPin, Search } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

export type ObserverAddressFormValue = {
  address_query: string;
  city: string;
  street: string;
  building_number: string;
  apartment_number: string;
  floor_kind: "ground" | "floor";
  floor_number: string;
  postal_code: string;
  address_place_id: string;
  address_session_token: string;
  formatted_address: string;
  address_verification_status: "unverified" | "suggested";
};

type Suggestion = { placeId: string; label: string };

async function addressPost(path: string, body: unknown, isCurrent: () => boolean = () => true) {
  if (!isCurrent()) return null;
  const token = readObserverAccessToken();
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!isCurrent()) return null;
  const payload = await response.json().catch(() => ({}));
  if (!isCurrent()) return null;
  if (!response.ok) throw new Error(payload.error || "שירות הכתובות אינו זמין");
  return payload.data;
}

function observerAddressValueKey(value: ObserverAddressFormValue) {
  return JSON.stringify([value.address_query, value.city, value.street, value.building_number, value.apartment_number, value.floor_kind, value.floor_number, value.postal_code, value.address_place_id, value.address_session_token, value.formatted_address, value.address_verification_status]);
}

export function ObserverAddressFields({ value, onChange, collapsibleDetails = false }: { value: ObserverAddressFormValue; onChange: (next: ObserverAddressFormValue) => void; collapsibleDetails?: boolean }) {
  const key = observerAddressValueKey(value);
  const controls = {};
  const [view, setView] = useState<{ key: string; suggestions: Suggestion[]; listEpoch: number; busy: boolean; message: string }>(() => ({ key, suggestions: [], listEpoch: 0, busy: false, message: "" }));
  const latest = useRef({ value, onChange, key, controls });
  const owner = useRef({ active: false, operation: 0, listEpoch: 0, token: "", suppliedToken: value.address_session_token, key, expectedKey: null as string | null, pending: null as { kind: "search" | "resolve"; value: string; token: string } | null });
  useLayoutEffect(() => {
    const lifetime = owner.current;
    lifetime.active = true;
    return () => { lifetime.active = false; lifetime.operation += 1; lifetime.pending = null; };
  }, []);
  useLayoutEffect(() => {
    const lifetime = owner.current;
    const external = key !== lifetime.key && key !== lifetime.expectedKey;
    const refusedEcho = lifetime.expectedKey !== null && key !== lifetime.expectedKey;
    const replacedSession = value.address_session_token !== lifetime.suppliedToken && value.address_session_token !== lifetime.token;
    if (!lifetime.token || replacedSession) lifetime.token = value.address_session_token || (typeof crypto !== "undefined" ? crypto.randomUUID() : `address-${Date.now()}`);
    if (external || refusedEcho || replacedSession) { lifetime.operation += 1; lifetime.listEpoch += 1; lifetime.pending = null; }
    lifetime.suppliedToken = value.address_session_token;
    lifetime.key = key;
    lifetime.expectedKey = null;
    latest.current = { value, onChange, key, controls };
  });
  const suggestions = view.key === key ? view.suggestions : [];
  const busy = view.key === key && view.busy;
  const message = view.key === key ? view.message : "";
  const ownsControls = () => owner.current.active && latest.current.controls === controls && (!owner.current.expectedKey || owner.current.expectedKey === key);
  function update(patch: Partial<ObserverAddressFormValue>) {
    if (!ownsControls()) return;
    const lifetime = owner.current;
    lifetime.operation += 1;
    lifetime.listEpoch += 1;
    lifetime.pending = null;
    const current = latest.current;
    const next = { ...current.value, ...patch, address_session_token: lifetime.token };
    const nextKey = observerAddressValueKey(next);
    lifetime.expectedKey = nextKey;
    setView({ key: nextKey, suggestions: [], listEpoch: lifetime.listEpoch, busy: false, message: "" });
    current.onChange(next);
  }
  const updateAddressPart = (patch: Partial<ObserverAddressFormValue>) => update({
    ...patch,
    address_place_id: "",
    formatted_address: "",
    address_verification_status: "unverified"
  });

  async function searchAddress() {
    if (!ownsControls()) return;
    const lifetime = owner.current;
    const query = latest.current.value.address_query;
    const token = lifetime.token;
    if (lifetime.pending?.kind === "search" && lifetime.pending.value === query && lifetime.pending.token === token) return;
    if (query.trim().length < 3) {
      setView({ key, suggestions, listEpoch: lifetime.listEpoch, busy: false, message: "יש להזין לפחות עיר, רחוב ומספר." });
      return;
    }
    const operation = ++lifetime.operation;
    lifetime.pending = { kind: "search", value: query, token };
    const isCurrent = () => lifetime.active && lifetime.operation === operation;
    setView({ key, suggestions, listEpoch: lifetime.listEpoch, busy: true, message: "" });
    try {
      const data = await addressPost("/api/digital-observer/address/autocomplete", {
        input: query,
        session_token: token
      }, isCurrent);
      if (!isCurrent()) return;
      const next = data.suggestions ?? [];
      lifetime.listEpoch += 1;
      setView({ key: latest.current.key, suggestions: next, listEpoch: lifetime.listEpoch, busy: false, message: next.length ? "" : "לא נמצאה התאמה. אפשר להמשיך במילוי ידני והכתובת תסומן לבדיקה." });
    } catch (error) {
      if (!isCurrent()) return;
      lifetime.listEpoch += 1;
      setView({ key: latest.current.key, suggestions: [], listEpoch: lifetime.listEpoch, busy: false, message: error instanceof Error ? error.message : "לא ניתן לחפש כתובת כרגע" });
    } finally {
      if (isCurrent()) lifetime.pending = null;
    }
  }

  async function selectAddress(suggestion: Suggestion) {
    if (!ownsControls() || view.listEpoch !== owner.current.listEpoch) return;
    const lifetime = owner.current;
    const placeId = suggestion.placeId;
    const label = suggestion.label;
    const token = lifetime.token;
    if (lifetime.pending?.kind === "resolve" && lifetime.pending.value === placeId && lifetime.pending.token === token) return;
    const operation = ++lifetime.operation;
    lifetime.pending = { kind: "resolve", value: placeId, token };
    const isCurrent = () => lifetime.active && lifetime.operation === operation;
    setView({ key, suggestions, listEpoch: lifetime.listEpoch, busy: true, message: "" });
    try {
      const data = await addressPost("/api/digital-observer/address/resolve", {
        place_id: placeId,
        session_token: token
      }, isCurrent);
      if (!isCurrent()) return;
      const address = data.address;
      const current = latest.current;
      const next = {
        ...current.value,
        address_query: label,
        city: address.city || current.value.city,
        street: address.street || current.value.street,
        building_number: address.buildingNumber || current.value.building_number,
        postal_code: address.postalCode || current.value.postal_code,
        address_place_id: address.placeId,
        formatted_address: address.formattedAddress,
        address_verification_status: "suggested" as const,
        address_session_token: token
      };
      if (!isCurrent()) return;
      const nextKey = observerAddressValueKey(next);
      lifetime.expectedKey = nextKey;
      lifetime.listEpoch += 1;
      setView({ key: nextKey, suggestions: [], listEpoch: lifetime.listEpoch, busy: false, message: "הכתובת נמצאה וסונכרנה. יש להשלים דירה וקומה לפי הצורך." });
      current.onChange(next);
    } catch (error) {
      if (isCurrent()) setView({ key: latest.current.key, suggestions, listEpoch: lifetime.listEpoch, busy: false, message: error instanceof Error ? error.message : "לא ניתן לאמת את הכתובת" });
    } finally {
      if (isCurrent()) lifetime.pending = null;
    }
  }

  const manualFields = <>
    <div className="do-form-grid">
      <label className="do-field"><span>עיר</span><input required value={value.city} onChange={(event) => { if (ownsControls()) updateAddressPart({ city: event.target.value }); }} /></label>
      <label className="do-field"><span>רחוב</span><input required value={value.street} onChange={(event) => { if (ownsControls()) updateAddressPart({ street: event.target.value }); }} /></label>
      <label className="do-field"><span>מספר בניין</span><input required inputMode="numeric" value={value.building_number} onChange={(event) => { if (ownsControls()) updateAddressPart({ building_number: event.target.value }); }} /></label>
      <label className="do-field"><span>מספר דירה</span><input inputMode="numeric" value={value.apartment_number} onChange={(event) => { if (ownsControls()) update({ apartment_number: event.target.value }); }} placeholder="אופציונלי" /></label>
      <label className="do-field"><span>סוג קומה</span><select value={value.floor_kind} onChange={(event) => { if (ownsControls()) update({ floor_kind: event.target.value as "ground" | "floor", floor_number: event.target.value === "ground" ? "0" : value.floor_number }); }}><option value="ground">קומת קרקע</option><option value="floor">קומה</option></select></label>
      <label className="do-field"><span>מספר קומה</span><input type="number" min={-5} max={120} disabled={value.floor_kind === "ground"} value={value.floor_kind === "ground" ? "0" : value.floor_number} onChange={(event) => { if (ownsControls()) update({ floor_number: event.target.value }); }} /></label>
    </div>
    <div className={value.address_place_id ? "do-notice good" : "do-notice warn"}>
      <MapPin />
      <span>{value.address_place_id ? "המיקום נקשר לכתובת אמיתית. הכתובת המדויקת לדיווח חירום דורשת אישור סופי לפני הפעלה." : "הכתובת עדיין לא אומתה מול ספק מפות. אפשר להקים את החשבון, אך דיווחי חירום ומפה יישארו חסומים עד אימות."}</span>
    </div>
  </>;

  return (
    <div className="do-address-block">
      <label className="do-field full">
        <span>חיפוש כתובת אמיתית</span>
        <span className="do-address-search">
          <input
            value={value.address_query}
            onChange={(event) => { if (ownsControls()) update({ address_query: event.target.value, address_place_id: "", formatted_address: "", address_verification_status: "unverified" }); }}
            placeholder="לדוגמה: דיזנגוף 100, תל אביב"
          />
          <button className="do-button secondary" type="button" onClick={searchAddress} disabled={busy}>
            {busy ? <LoaderCircle className="do-spin" /> : <Search />} חיפוש
          </button>
        </span>
      </label>
      {suggestions.length ? <div className="do-address-suggestions" role="listbox" aria-label="כתובות מוצעות">{suggestions.map((suggestion) => <button type="button" role="option" key={suggestion.placeId} onClick={() => selectAddress(suggestion)}><MapPin /><span>{suggestion.label}</span></button>)}</div> : null}
      {message ? <p className={value.address_place_id ? "do-address-message verified" : "do-address-message"}>{value.address_place_id ? <CheckCircle2 /> : <MapPin />}{message}</p> : null}
      {collapsibleDetails ? <details className="do-address-details"><summary><MapPin /> השלמת עיר, רחוב, מספר, דירה וקומה</summary>{manualFields}</details> : manualFields}
    </div>
  );
}
