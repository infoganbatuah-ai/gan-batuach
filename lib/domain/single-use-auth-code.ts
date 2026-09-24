/** Keep a one-time auth code exchange shared by effect replays in this browser tab. */
export function singleUseAuthCodeExchange<T>(exchange: (code: string) => Promise<T>) {
  let lastAttempt: { code: string; result: Promise<T> } | null = null;

  return (code: string): Promise<T> => {
    if (lastAttempt?.code === code) return lastAttempt.result;
    const result = exchange(code);
    lastAttempt = { code, result };
    return result;
  };
}
