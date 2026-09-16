import { fail } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";

// The old child-level status mutation cannot identify a billing period and is
// intentionally retired. Use the locked, period-specific tuition ledger route.
export async function POST() {
  const access = await getManagementGardenContext();
  if (!access.allowed) return access.response;
  return fail("יש לעדכן תשלום עבור תקופת חיוב מסוימת במסך שכר הלימוד.", 410);
}
