import { redirect } from "next/navigation";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

function pick(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DigitalObserverStartPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const type = pick(params.site_type) === "business" ? "business" : "home";
  redirect(`/digital-observer/register?type=${type}`);
}
