"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, Eye, Home, Search, ShieldCheck, Smartphone } from "lucide-react";

export function AppMotionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDigitalObserver = pathname.startsWith("/digital-observer");
  const [ready, setReady] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);

  useEffect(() => {
    setReady(true);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    setMobilePreview(requestedView === "mobile");
  }, [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("gb-mobile-preview-mode", mobilePreview);
    document.body.classList.toggle("gb-mobile-preview-mode", mobilePreview);
    document.body.dataset.viewMode = mobilePreview ? "mobile-preview" : "responsive";
    return () => {
      document.documentElement.classList.remove("gb-mobile-preview-mode");
      document.body.classList.remove("gb-mobile-preview-mode");
      delete document.body.dataset.viewMode;
    };
  }, [mobilePreview]);

  return (
    <>
      <BrandedSplash ready={ready} observer={isDigitalObserver} />
      <PwaInstallPrompt observer={isDigitalObserver} />
      <motion.div className="app-page-transition" initial={false} animate={{ opacity: 1 }} data-view-mode={mobilePreview ? "mobile-preview" : "responsive"}>
        {children}
      </motion.div>
    </>
  );
}

function BrandedSplash({ ready, observer }: { ready: boolean; observer: boolean }) {
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (!ready) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), 750);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (!mounted) return null;

  return (
    <motion.div className="branded-splash" initial={{ opacity: 1 }} animate={{ opacity: ready ? 0 : 1, pointerEvents: ready ? "none" : "auto" }} transition={{ delay: 0.2, duration: 0.45 }} aria-hidden="true">
      {observer ? (
        <motion.div className="splash-logo digital-observer-splash-logo" initial={{ scale: 0.86, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: "easeOut" }}>
          <span><ShieldCheck /><Eye /></span>
          <strong>תצפיתן דיגיטלי</strong>
        </motion.div>
      ) : (
        <motion.div className="splash-logo" initial={{ scale: 0.86, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: "easeOut" }}>
          <Image src="/assets/company-symbol.png" alt="" width={88} height={88} priority />
          <Image src="/assets/company-name.png" alt="גן בטוח" width={150} height={42} priority />
        </motion.div>
      )}
      <div className="splash-shimmer" />
    </motion.div>
  );
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function PwaInstallPrompt({ observer }: { observer: boolean }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);
  const isStandalone = useMemo(() => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone), []);

  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setInstallEvent(event as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (hidden || isStandalone || !installEvent) return null;
  return <motion.div className="install-prompt" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}><Smartphone size={18} /><span>התקינו את {observer ? "התצפיתן הדיגיטלי" : "גן בטוח"} כאפליקציה</span><button type="button" onClick={async () => { await installEvent.prompt(); setHidden(true); }}>התקנה</button><button type="button" className="ghost-install" onClick={() => setHidden(true)}>לא עכשיו</button></motion.div>;
}

export function MobilePublicTabs() {
  const pathname = usePathname();
  const isPublicMarketingRoute =
    pathname === "/" ||
    pathname === "/parents-demand" ||
    pathname === "/book-demo" ||
    pathname === "/kindergarten-directory";

  if (!isPublicMarketingRoute) return null;

  return <nav className="mobile-public-tabs" aria-label="ניווט מהיר"><Link href="/"><Home size={19} /><span>בית</span></Link><Link href="/parents-demand"><Search size={19} /><span>הורים</span></Link><Link href="/book-demo"><ShieldCheck size={19} /><span>הדגמה</span></Link><Link href="/app"><Bell size={19} /><span>מערכת</span></Link></nav>;
}
