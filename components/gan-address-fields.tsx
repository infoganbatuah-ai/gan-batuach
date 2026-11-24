"use client";

import { useRef, useState } from "react";
import { CheckCircle2, MapPin, Search } from "lucide-react";

type Suggestion = { placeId: string; label: string };
type Address = { placeId: string; formattedAddress: string; city: string; street: string; buildingNumber: string };

async function postAddress(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "שירות הכתובות אינו זמין כרגע");
  return result.data;
}

export function GanAddressFields({ mode = "full", initialCity = "", initialStreet = "", initialBuilding = "", initialAddress = "", buildingName = "building_number", requiredCity = false, requiredStreet = false, requiredBuilding = false }: {
  mode?: "city" | "full";
  initialCity?: string;
  initialStreet?: string;
  initialBuilding?: string;
  initialAddress?: string;
  buildingName?: string;
  requiredCity?: boolean;
  requiredStreet?: boolean;
  requiredBuilding?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(initialCity);
  const [street, setStreet] = useState(initialStreet);
  const [building, setBuilding] = useState(initialBuilding);
  const [formatted, setFormatted] = useState(initialAddress);
  const [placeId, setPlaceId] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const requestId = useRef(0);
  const lastSearch = useRef(0);
  const token = () => { if (sessionToken) return sessionToken; const created = crypto.randomUUID(); setSessionToken(created); return created; };
  const clearSelection = () => { if (placeId) setSessionToken(""); setPlaceId(""); setFormatted(""); };

  async function search() {
    if (query.trim().length < 6) { setMessage("יש להקליד לפחות שש אותיות לחיפוש."); return; }
    if (Date.now() - lastSearch.current < 750) return;
    lastSearch.current = Date.now();
    const current = ++requestId.current;
    setBusy(true);
    setMessage("");
    try {
      const result = await postAddress("/api/management/address/autocomplete", { input: query.trim(), session_token: token() });
      if (current !== requestId.current) return;
      setSuggestions((result.suggestions ?? []).slice(0, 5));
      if (!result.suggestions?.length) setMessage("לא נמצאה התאמה. אפשר להמשיך ידנית; הכתובת תסומן כלא מאומתת.");
    } catch (error) {
      if (current === requestId.current) { setSuggestions([]); setMessage(error instanceof Error ? error.message : "החיפוש נכשל"); }
    } finally { if (current === requestId.current) setBusy(false); }
  }

  async function select(suggestion: Suggestion) {
    const current = ++requestId.current;
    setBusy(true);
    setMessage("");
    try {
      const result = await postAddress("/api/management/address/resolve", { place_id: suggestion.placeId, session_token: token() });
      if (current !== requestId.current) return;
      const address = result.address as Address;
      setCity(address.city);
      if (mode === "full") { setStreet(address.street); setBuilding(address.buildingNumber); }
      setFormatted(address.formattedAddress);
      setQuery(suggestion.label);
      setSuggestions([]);
      if (address.city && (mode === "city" || (address.street && address.buildingNumber))) {
        setPlaceId(address.placeId);
        setMessage("הבחירה נמצאה. האימות הסופי יתבצע בצד השרת בעת השמירה.");
      } else {
        setPlaceId("");
        setMessage("הבחירה אינה כוללת פרטי כתובת מלאים. השלימו ידנית; היא תישמר כלא מאומתת.");
      }
    } catch (error) {
      if (current === requestId.current) setMessage(error instanceof Error ? error.message : "לא ניתן לאמת את הבחירה");
    } finally { if (current === requestId.current) setBusy(false); }
  }

  return <div className="wide gan-address-fields">
    <label>חיפוש {mode === "city" ? "עיר" : "כתובת"} אמיתית
      <span className="gan-address-search"><input value={query} onChange={(event) => { setQuery(event.target.value); clearSelection(); setSuggestions([]); requestId.current++; }} placeholder={mode === "city" ? "הקלידו שם עיר בישראל" : "עיר, רחוב ומספר בניין"} autoComplete="off" />
        <button className="button secondary" type="button" disabled={busy} onClick={search}><Search size={16} /> חיפוש</button></span>
    </label>
    {suggestions.length ? <div role="listbox" aria-label="תוצאות חיפוש כתובות" className="gan-address-results">{suggestions.map((item) => <button key={item.placeId} type="button" role="option" aria-selected={false} onClick={() => select(item)}><MapPin size={16} /> {item.label}</button>)}</div> : null}
    <div className="form-grid">
      <label>עיר {requiredCity ? "*" : ""}<input name="city" required={requiredCity} value={city} onChange={(event) => { setCity(event.target.value); clearSelection(); }} /></label>
      {mode === "full" ? <><label>רחוב {requiredStreet ? "*" : ""}<input name="street" required={requiredStreet} value={street} onChange={(event) => { setStreet(event.target.value); clearSelection(); }} /></label>
        <label>מספר בניין {requiredBuilding ? "*" : ""}<input name={buildingName} required={requiredBuilding} value={building} onChange={(event) => { setBuilding(event.target.value); clearSelection(); }} /></label></> : null}
    </div>
    <input type="hidden" name="address_place_id" value={placeId} />
    <input type="hidden" name="address_session_token" value={sessionToken} />
    {mode === "full" ? <input type="hidden" name="address" value={placeId ? formatted : [street, building, city].filter(Boolean).join(", ")} /> : null}
    <p role="status" className={placeId ? "gan-address-verified" : "gan-address-unverified"}>{placeId ? <CheckCircle2 size={16} /> : <MapPin size={16} />}{message || (placeId ? "כתובת נבחרה; האימות הסופי יבוצע בשמירה." : "כתובת ידנית תישמר כלא מאומתת, ללא מיקום מפה מומצא.")}</p>
  </div>;
}
