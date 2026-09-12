import { AppRoleRegisterScreen } from "@/components/app-register-screens";

export default async function StaffAppRegisterPage({ searchParams }: { searchParams: Promise<{ invitation_token?: string }> }) {
  const params = await searchParams;
  return <AppRoleRegisterScreen role="staff_candidate" invitationToken={params.invitation_token} />;
}
