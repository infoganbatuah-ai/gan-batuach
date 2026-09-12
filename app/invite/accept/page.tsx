import { BrandHeader } from "@/components/brand-header";
import { InvitationAcceptScreen } from "@/components/invitation-accept-screen";
import { getSessionProfile } from "@/lib/auth";

export default async function InvitationAcceptPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token = "" }, session] = await Promise.all([searchParams, getSessionProfile()]);
  return <><BrandHeader /><InvitationAcceptScreen token={token} signedInRole={session.user ? session.profile?.role ?? null : null} /></>;
}
