export type PersistedAuthProduct = "digital_observer" | "gan_batuach" | "both" | "none";

export function resolvePersistedAuthProduct(input: {
  hasObserverAccount: boolean;
  hasGanProfile: boolean;
  hasGanParent: boolean;
  ganRole?: string | null;
}): PersistedAuthProduct {
  const hasGanAccess = input.hasGanProfile
    && (input.ganRole !== "parent" || input.hasGanParent);

  if (input.hasObserverAccount && hasGanAccess) return "both";
  if (input.hasObserverAccount) return "digital_observer";
  if (hasGanAccess) return "gan_batuach";
  return "none";
}
