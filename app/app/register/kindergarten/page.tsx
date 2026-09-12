import { AppRoleRegisterScreen } from "@/components/app-register-screens";

export default async function KindergartenAppRegisterPage({ searchParams }: { searchParams: Promise<{ invitation_token?: string; role?: string }> }) {
  const params = await searchParams;
  return <AppRoleRegisterScreen role={params.role === "owner" ? "kindergarten_owner" : "kindergarten_manager"} invitationToken={params.invitation_token} />;
}
