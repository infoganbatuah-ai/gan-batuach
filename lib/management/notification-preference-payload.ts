const externalChannels = ["push", "email", "whatsapp", "sms"] as const;

export function availableChannelPatch(data: FormData, available: ReadonlySet<string>) {
  return Object.fromEntries(externalChannels
    .filter((channel) => available.has(channel))
    .map((channel) => [`receive_${channel}`, data.get(`receive_${channel}`) === "on"]));
}

export function externalCategoryChoices(channels: Record<string, string[]>) {
  const allowed = new Set<string>(externalChannels);
  return Object.fromEntries(Object.entries(channels).map(([category, values]) => [
    category, values.filter((value) => allowed.has(value))
  ]));
}
