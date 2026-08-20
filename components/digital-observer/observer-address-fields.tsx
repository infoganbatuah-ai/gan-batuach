"use client";

import { useRef, useState } from "react";
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

async function addressPost(path: string, body: unknown) {
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
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "שירות הכתובות אינו זמין");
  return payload.data;
}

export function ObserverAddressFields({ value, onChange }: { value: ObserverAddressFormValue; onChange: (next: ObserverAddressFormValue) => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const token = useRef(value.address_session_token || (typeof crypto !== "undefined" ? crypto.randomUUID() : `address-${Date.now()}`));
  const update = (patch: Partial<ObserverAddressFormValue>) => onChange({ ...value, ...patch, address_session_token: token.current });
  const updateAddressPart = (patch: Partial<ObserverAddressFormValue>) => update({
    ...patch,
    address_place_id: "",
    formatted_address: "",
    address_verification_status: "unverified"
  });

  async function searchAddress() {
    if (value.address_query.trim().length < 3) {
      setMessage("יש להזין לפחות עיר, רחוב ומספר.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const data = await addressPost("/api/digital-observer/address/autocomplete", {
        input: value.address_query,
        session_token: token.current
      });
      setSuggestions(data.suggestions ?? []);
      if (!data.suggestions?.length) setMessage("לא נמצאה התאמה. אפשר להמשיך במילוי ידני והכתובת תסומן לבדיקה.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לחפש כתובת כרגע");
      setSuggestions([]);
    } finally {
      setBusy(false);
    }
  }

  async function selectAddress(suggestion: Suggestion) {
    setBusy(true);
    setMessage("");
    try {
      const data = await addressPost("/api/digital-observer/address/resolve", {
        place_id: suggestion.placeId,
        session_token: token.current
      });
      const address = data.address;
      update({
        address_query: suggestion.label,
        city: address.city || value.city,
        street: address.street || value.street,
        building_number: address.buildingNumber || value.building_number,
        postal_code: address.postalCode || value.postal_code,
        address_place_id: address.placeId,
        formatted_address: address.formattedAddress,
        address_verification_status: "suggested"
      });
      setSuggestions([]);
      setMessage("הכתובת נמצאה וסונכרנה. יש להשלים דירה וקומה לפי הצורך.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לאמת את הכתובת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="do-address-block">
      <label className="do-field full">
        <span>חיפוש כתובת אמיתית</span>
        <span className="do-address-search">
          <input
            value={value.address_query}
            onChange={(event) => update({ address_query: event.target.value, address_place_id: "", formatted_address: "", address_verification_status: "unverified" })}
            placeholder="לדוגמה: דיזנגוף 100, תל אביב"
          />
          <button className="do-button secondary" type="button" onClick={searchAddress} disabled={busy}>
            {busy ? <LoaderCircle className="do-spin" /> : <Search />} חיפוש
          </button>
        </span>
      </label>
      {suggestions.length ? <div className="do-address-suggestions" role="listbox" aria-label="כתובות מוצעות">{suggestions.map((suggestion) => <button type="button" role="option" key={suggestion.placeId} onClick={() => selectAddress(suggestion)}><MapPin /><span>{suggestion.label}</span></button>)}</div> : null}
      {message ? <p className={value.address_place_id ? "do-address-message verified" : "do-address-message"}>{value.address_place_id ? <CheckCircle2 /> : <MapPin />}{message}</p> : null}
      <div className="do-form-grid">
        <label className="do-field"><span>עיר</span><input required value={value.city} onChange={(event) => updateAddressPart({ city: event.target.value })} /></label>
        <label className="do-field"><span>רחוב</span><input required value={value.street} onChange={(event) => updateAddressPart({ street: event.target.value })} /></label>
        <label className="do-field"><span>מספר בניין</span><input required inputMode="numeric" value={value.building_number} onChange={(event) => updateAddressPart({ building_number: event.target.value })} /></label>
        <label className="do-field"><span>מספר דירה</span><input inputMode="numeric" value={value.apartment_number} onChange={(event) => update({ apartment_number: event.target.value })} placeholder="אופציונלי" /></label>
        <label className="do-field"><span>סוג קומה</span><select value={value.floor_kind} onChange={(event) => update({ floor_kind: event.target.value as "ground" | "floor", floor_number: event.target.value === "ground" ? "0" : value.floor_number })}><option value="ground">קומת קרקע</option><option value="floor">קומה</option></select></label>
        <label className="do-field"><span>מספר קומה</span><input type="number" min={-5} max={120} disabled={value.floor_kind === "ground"} value={value.floor_kind === "ground" ? "0" : value.floor_number} onChange={(event) => update({ floor_number: event.target.value })} /></label>
      </div>
      <div className={value.address_place_id ? "do-notice good" : "do-notice warn"}>
        <MapPin />
        <span>{value.address_place_id ? "המיקום נקשר לכתובת אמיתית. הכתובת המדויקת לדיווח חירום דורשת אישור סופי לפני הפעלה." : "הכתובת עדיין לא אומתה מול ספק מפות. אפשר להקים את החשבון, אך דיווחי חירום ומפה יישארו חסומים עד אימות."}</span>
      </div>
    </div>
  );
}
