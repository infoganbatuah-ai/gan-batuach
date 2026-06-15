import { AppLoginScreen } from "@/components/app-login-screen";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string; gardenId?: string; audience?: string }> }) {
  return <AppLoginScreen searchParams={searchParams} />;
}
