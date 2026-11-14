"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Eye, LoaderCircle, Save, ShieldCheck, UserRound, X } from "lucide-react";

type SafeProfile = {
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  profile_image_url?: string | null;
  role_label?: string | null;
  garden_name?: string | null;
};

function isAppPath(pathname: string) {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding") || pathname.startsWith("/parent-onboarding") || pathname.startsWith("/digital-observer");
}

export function DashboardLiveExperience() {
  const pathname = usePathname();
  const isDigitalObserver = pathname.startsWith("/digital-observer");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<SafeProfile | null>(null);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const busyTimer = useRef<number | null>(null);
  const profileOpener = useRef<HTMLElement | null>(null);
  const profileDialog = useRef<HTMLElement | null>(null);
  const profileCloseButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setBusy(false);
    if (busyTimer.current) window.clearTimeout(busyTimer.current);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const dialog = profileDialog.current;
    const opener = profileOpener.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    profileCloseButton.current?.focus();

    function focusableControls() {
      return [...(dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])]
        .filter((element) => element.getClientRects().length > 0);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setProfileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusableControls();
      if (!controls.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!dialog?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onFocusIn(event: FocusEvent) {
      if (!dialog?.contains(event.target as Node)) (focusableControls()[0] ?? dialog)?.focus();
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [profileOpen]);

  useEffect(() => {
    function beginBusy() {
      setBusy(true);
      if (busyTimer.current) window.clearTimeout(busyTimer.current);
      // Search-param-only transitions do not change usePathname, so keep a
      // short fallback instead of leaving the in-app loader visible.
      busyTimer.current = window.setTimeout(() => setBusy(false), 1800);
    }

    async function openProfile() {
      setProfileOpen(true);
      setProfileMessage("");
      setProfileBusy(true);
      try {
        const response = await fetch("/api/profile/settings", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "לא ניתן לטעון את הפרופיל כרגע");
        setProfile(body.data?.profile ?? null);
      } catch (error) {
        setProfileMessage(error instanceof Error ? error.message : "לא ניתן לטעון את הפרופיל כרגע");
      } finally {
        setProfileBusy(false);
      }
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const panelTrigger = target?.closest<HTMLElement>("[data-live-panel='profile']");
      if (panelTrigger) {
        event.preventDefault();
        profileOpener.current = panelTrigger;
        void openProfile();
        return;
      }
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("/api/")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !isAppPath(url.pathname)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      beginBusy();
      router.push(`${url.pathname}${url.search}${url.hash}`);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (busyTimer.current) window.clearTimeout(busyTimer.current);
    };
  }, [router]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: String(form.get("full_name") ?? "").trim(),
          phone: String(form.get("phone") ?? "").trim(),
          address: String(form.get("address") ?? "").trim()
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לשמור כרגע");
      setProfile((current) => ({ ...current, ...(body.data?.profile ?? {}) }));
      setProfileMessage("הפרופיל נשמר בהצלחה");
      router.refresh();
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "לא ניתן לשמור כרגע");
    } finally {
      setProfileBusy(false);
    }
  }

  return (
    <>
      <div className={`gb-live-route-loader ${busy ? "is-visible" : ""}`} aria-live="polite" aria-hidden={!busy}>
        <span className={`gb-live-route-mark ${isDigitalObserver ? "is-observer" : ""}`}>
          {isDigitalObserver ? <span className="gb-observer-route-icon"><ShieldCheck /><Eye /></span> : <Image src="/assets/company-symbol.png" alt="" width={34} height={34} />}
          <LoaderCircle size={20} />
        </span>
        <span><b>{isDigitalObserver ? "תצפיתן דיגיטלי" : "גן בטוח"}</b><small>פותחים את הפעולה בתוך המערכת...</small></span>
      </div>

      {profileOpen ? (
        <div className="gb-live-drawer-layer" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setProfileOpen(false);
        }}>
          <aside ref={profileDialog} className="gb-live-profile-drawer" role="dialog" aria-modal="true" aria-labelledby="gb-live-profile-title" tabIndex={-1}>
            <header>
              <button ref={profileCloseButton} type="button" onClick={() => setProfileOpen(false)} aria-label="סגירת פרופיל"><X /></button>
              <div>
                <span><UserRound /></span>
                <div><h2 id="gb-live-profile-title">הפרופיל שלי</h2><p>הפרטים מחוברים לחשבון הפעיל</p></div>
              </div>
            </header>
            {profileBusy && !profile ? <div className="gb-live-panel-loading"><LoaderCircle /><span>טוענים פרטים...</span></div> : null}
            {profile ? (
              <form onSubmit={saveProfile}>
                <div className="gb-live-profile-summary">
                  <span>{profile.profile_image_url ? <img src={profile.profile_image_url} alt="" /> : (profile.full_name?.slice(0, 1) || "ג")}</span>
                  <div><strong>{profile.full_name || "משתמש/ת"}</strong><small>{profile.role_label || "חשבון גן בטוח"}{profile.garden_name ? ` · ${profile.garden_name}` : ""}</small></div>
                </div>
                <label>שם מלא<input name="full_name" minLength={2} required defaultValue={profile.full_name ?? ""} /></label>
                <label>טלפון<input name="phone" inputMode="tel" defaultValue={profile.phone ?? ""} /></label>
                <label>כתובת<input name="address" defaultValue={profile.address ?? ""} /></label>
                <label>אימייל<input value={profile.email ?? "לא הוגדר"} readOnly /></label>
                <button className="button primary" type="submit" disabled={profileBusy}><Save size={18} /> {profileBusy ? "שומר..." : "שמירת שינויים"}</button>
              </form>
            ) : null}
            {profileMessage ? <p className={profileMessage.includes("בהצלחה") ? "gb-live-success" : "error-text"}>{profileMessage.includes("בהצלחה") ? <CheckCircle2 size={18} /> : null}{profileMessage}</p> : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}
