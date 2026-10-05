import { notFound } from "next/navigation";
import { GlobalStateShowcase } from "@/components/global-state-showcase";
import { type Ux19View, ux19Views } from "@/lib/ui/ux19-views";

export const dynamic = "force-dynamic";

export default async function Ux19SystemStatesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  const selected = ux19Views.includes(view as Ux19View) ? view as Ux19View : "loading";
  return <GlobalStateShowcase initialView={selected} />;
}
