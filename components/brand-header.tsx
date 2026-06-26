import Image from "next/image";
import Link from "next/link";

export function BrandHeader() {
  return (
    <header className="gb-public-header">
      <Link href="/" className="gb-public-brand" aria-label="גן בטוח">
        <Image src="/assets/company-symbol.png" alt="" width={48} height={48} priority />
        <Image src="/assets/company-name.png" alt="גן בטוח" width={146} height={46} priority />
      </Link>
      <nav aria-label="ניווט ציבורי">
        <Link href="/">ראשי</Link>
        <Link href="/parents">הורים</Link>
        <Link href="/join-kindergarten">גני ילדים</Link>
        <Link href="/staff">צוות גן</Link>
        <Link href="/join-inspector">מפקחים</Link>
        <Link href="/digital-observer">התצפיתן הדיגיטלי</Link>
        <Link href="/kindergarten-directory">רשימת גנים</Link>
      </nav>
      <div className="gb-public-header-actions">
        <Link className="gb-public-button ghost" href="/app/login">התחברות</Link>
        <Link className="gb-public-button primary" href="/app/register">הרשמה</Link>
        <Link className="nav-system-entry" href="/app">כניסה למערכת</Link>
      </div>
    </header>
  );
}
