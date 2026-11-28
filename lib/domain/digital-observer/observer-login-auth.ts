export type ObserverLoginUser = {
  id: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

type AuthError = { code?: string; message?: string } | null;

export type ObserverLoginDependencies<TUser extends ObserverLoginUser> = {
  signIn(email: string, password: string): Promise<{ user: TUser | null; error: AuthError }>;
  currentUser(): Promise<{ user: TUser | null; error: AuthError }>;
  ensureOwnAccount(user: TUser): Promise<{ ok: boolean; code?: string }>;
  signOut(): Promise<{ error?: AuthError }>;
};

export type ObserverLoginResult<TUser extends ObserverLoginUser> =
  | { status: "ok"; user: TUser }
  | { status: "invalid_login"; error: AuthError }
  | { status: "identity_mismatch" | "observer_setup_required"; error: null; code?: string }
  | { status: "session_cleanup_failed"; error: null };

async function sessionCleanup<TUser extends ObserverLoginUser>(dependencies: ObserverLoginDependencies<TUser>) {
  try {
    return !(await dependencies.signOut()).error;
  } catch {
    return false;
  }
}

/** The provisioning RPC may run only after a fresh login matches getUser(). */
export async function authenticateAndPrepareObserverLogin<TUser extends ObserverLoginUser>(
  email: string,
  password: string,
  dependencies: ObserverLoginDependencies<TUser>
): Promise<ObserverLoginResult<TUser>> {
  const login = await dependencies.signIn(email, password);
  if (login.error || !login.user) {
    // Failed password authentication did not establish a new session. Do not
    // revoke an unrelated account's pre-existing browser session.
    return { status: "invalid_login", error: login.error };
  }

  let current: { user: TUser | null; error: AuthError };
  try {
    current = await dependencies.currentUser();
  } catch {
    if (!await sessionCleanup(dependencies)) return { status: "session_cleanup_failed", error: null };
    return { status: "identity_mismatch", error: null };
  }
  if (current.error || !current.user || current.user.id !== login.user.id) {
    if (!await sessionCleanup(dependencies)) return { status: "session_cleanup_failed", error: null };
    return { status: "identity_mismatch", error: null };
  }

  let account: { ok: boolean; code?: string };
  try {
    account = await dependencies.ensureOwnAccount(current.user);
  } catch {
    if (!await sessionCleanup(dependencies)) return { status: "session_cleanup_failed", error: null };
    return { status: "observer_setup_required", error: null, code: "account_preparation_exception" };
  }
  if (!account.ok) {
    if (!await sessionCleanup(dependencies)) return { status: "session_cleanup_failed", error: null };
    return { status: "observer_setup_required", error: null, code: account.code };
  }

  return { status: "ok", user: current.user };
}

type Query<T> = { data: T | null; error: unknown };

export function resolveObserverLoginContext(input: {
  userId: string;
  observerAdmin: boolean;
  requestedNext: string;
  profile: Query<{ id: string; active?: boolean | null }>;
  account: Query<{ profile_id: string; account_type?: string | null }>;
  ownedSite: Query<unknown>;
  membership: Query<unknown>;
}): { ok: true; destination: string } | { ok: false } {
  if (input.profile.error || input.account.error || input.ownedSite.error || input.membership.error) return { ok: false };
  if (!input.profile.data || input.profile.data.id !== input.userId || input.profile.data.active === false) return { ok: false };
  if (!input.account.data || input.account.data.profile_id !== input.userId) return { ok: false };

  const hasSite = Boolean(input.ownedSite.data || input.membership.data);
  const accountType = input.account.data.account_type === "business" ? "business" : "home";
  const destination = input.observerAdmin && input.requestedNext === "/digital-observer/dashboard"
    ? "/digital-observer/admin"
    : !hasSite && input.requestedNext === "/digital-observer/dashboard"
      ? `/digital-observer/onboarding?type=${accountType}`
      : input.requestedNext;
  return { ok: true, destination };
}
