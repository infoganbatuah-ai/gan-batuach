import Image from "next/image";

export default function Loading() {
  return <div className="loading-screen" role="status" aria-live="polite"><div className="loading-logo-card"><Image src="/assets/company-symbol.png" alt="" width={74} height={74} priority /><Image src="/assets/company-name.png" alt="גן בטוח" width={132} height={38} priority /><div className="loading-dots"><span /><span /><span /></div></div><div className="skeleton-stack"><span /><span /><span /></div></div>;
}
