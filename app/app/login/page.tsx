import { AppLoginScreen } from "@/components/app-login-screen";

export const metadata = {
  title: "כניסה למערכת | גן בטוח",
  description: "כניסה אפליקטיבית לחשבון גן בטוח בדפדפן."
};

export default async function AppLoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string; gardenId?: string; audience?: string }> }) {
  return <AppLoginScreen searchParams={searchParams} />;
}
