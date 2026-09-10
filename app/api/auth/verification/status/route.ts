import { fail, handleRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { managementContactVerification, maskContact } from "@/lib/management/contact-verification";

export async function GET() {
  try {
    const { user, profile } = await getSessionProfile();
    if (!user || !profile) return fail("נדרשת התחברות מחדש.", 401);
    const state = managementContactVerification(user, profile);
    return ok({
      ...state,
      email: maskContact(user.email),
      phone: maskContact(user.phone)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
