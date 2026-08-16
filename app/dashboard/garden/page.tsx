import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export default async function GardenDashboard() {
  await requireRole(["manager", "owner"]);
  redirect("/dashboard/garden/operations");
}
