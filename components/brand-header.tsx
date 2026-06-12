import Image from "next/image";
import Link from "next/link";

export function BrandHeader() {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span>
          <Image className="brand-name" src="/assets/company-name.png" alt="גן בטוח" width={118} height={26} priority />
          <small>ניהול, שקיפות ופיקוח</small>
        </span>
        <span className="brand-symbol">
          <Image src="/assets/company-symbol.png" alt="" width={34} height={34} priority />
        </span>
      </Link>
      <nav className="nav" aria-label="ניווט ראשי">
        <Link href="/why-gan-batuach">למה גן בטוח</Link>
        <Link href="/safety-standard">תקן הבטיחות</Link>
        <Link href="/parents-demand">להורים</Link>
        <Link href="/kindergarten-directory">גנים</Link>
        <Link href="/book-demo">קביעת הדגמה</Link>
        <Link href="/login">כניסה</Link>
      </nav>
    </header>
  );
}
