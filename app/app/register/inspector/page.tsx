import { AppRoleRegisterScreen } from "@/components/app-register-screens";

export default async function InspectorAppRegisterPage({ searchParams }: { searchParams: Promise<{ invitation_token?: string }> }) {
  const params = await searchParams;
  return <AppRoleRegisterScreen role="inspector_candidate" invitationToken={params.invitation_token} />;
}
