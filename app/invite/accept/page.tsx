import { AppAuthShell } from "@/components/app-auth-shell";
import { InvitationAcceptScreen } from "@/components/invitation-accept-screen";
import { getSessionProfile } from "@/lib/auth";

export default async function InvitationAcceptPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token = "" }, session] = await Promise.all([searchParams, getSessionProfile()]);
  return <AppAuthShell eyebrow="הזמנה אישית" title="הצטרפות לגן בטוח" subtitle="נבדוק את ההזמנה המאובטחת ונציג רק את הפרטים הדרושים להמשך."><InvitationAcceptScreen token={token} signedInRole={session.user ? session.profile?.role ?? null : null} /></AppAuthShell>;
}
