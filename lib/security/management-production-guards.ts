import "server-only";

import { SafeHttpError } from "@/lib/api";

export function isManagementProductionEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (env.APP_ENV) return env.APP_ENV === "production";
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  return env.NODE_ENV === "production";
}

export function assertManagementInternalToolAccess(env: NodeJS.ProcessEnv = process.env) {
  if (isManagementProductionEnvironment(env)) {
    throw new SafeHttpError("INTERNAL_TOOL_UNAVAILABLE", 404);
  }
}
