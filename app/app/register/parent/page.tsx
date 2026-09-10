import { AppRoleRegisterScreen } from "@/components/app-register-screens";

export default async function ParentAppRegisterPage({ searchParams }: { searchParams: Promise<{ invitation_token?: string }> }) {
  const params = await searchParams;
  return <AppRoleRegisterScreen role="parent" invitationToken={params.invitation_token} />;
}
