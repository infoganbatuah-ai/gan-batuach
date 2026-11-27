import "server-only";
import { z } from "zod";
import { getDigitalObserverApiUser } from "../access";
import { pendingProductKey, type OperatorRequest } from "./pending";

const accountRow = z.object({profile_id:z.string().uuid(), account_type:z.string(), status:z.string()});
const siteRow = z.object({id:z.string().uuid(), owner_profile_id:z.string().uuid(),
  garden_id:z.null(), site_type:z.string()});
const sourceRow = z.object({id:z.string().uuid(), observer_site_id:z.string().uuid()});

// The generated Database type omits
// these additive Observer tables. Validate returned rows at the boundary.
export function preparePendingOnProductServer(request: Request, body: unknown, operator: OperatorRequest) {
  return pendingProductKey(request, body, operator, productReader());
}

async function authorize(authRequest: Request) {
  const s = await getDigitalObserverApiUser(authRequest);
  if (!s) return null;
  const account = accountRow.safeParse(s.observerAccount);
  return account.success ? {...s, observerAccount:account.data} : null;
}

function productReader() {
  return {
    project: process.env.NEXT_PUBLIC_SUPABASE_URL,
    authorize,
    async readScope(session: NonNullable<Awaited<ReturnType<typeof authorize>>>, siteId: string, sourceId: string) {
      const [site, source] = await Promise.all([
        session.supabase.from("observer_sites" as never).select("id,owner_profile_id,garden_id,site_type")
          .eq("id",siteId).eq("owner_profile_id",session.user.id).is("garden_id",null).maybeSingle(),
        session.supabase.from("digital_observer_camera_sources" as never).select("id,observer_site_id")
          .eq("id",sourceId).eq("observer_site_id",siteId).maybeSingle()
      ]);
      if (site.error || source.error) return null;
      return {site:siteRow.parse(site.data), source:sourceRow.parse(source.data)};
    }
  };
}
