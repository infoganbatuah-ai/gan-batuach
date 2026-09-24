import Image from "next/image";

export function GanBatuachBrand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <div className={`gb-brand-lockup${compact ? " compact" : ""}${inverse ? " inverse" : ""}`} aria-label="גן בטוח">
      <Image className="gb-brand-mark" src="/assets/company-symbol.png" alt="" width={compact ? 50 : 72} height={compact ? 50 : 72} priority />
      <div>
        <Image className="gb-brand-name" src="/assets/company-name.png" alt="גן בטוח" width={compact ? 120 : 160} height={compact ? 41 : 54} priority />
        {!compact ? <span>ילדים בטוחים · עתיד טוב יותר</span> : null}
      </div>
    </div>
  );
}
