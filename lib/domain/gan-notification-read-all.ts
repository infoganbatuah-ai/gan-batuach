type MarkReadResponse = { ok: boolean };
type MarkReadFetcher = (url: string, init: RequestInit) => Promise<MarkReadResponse>;

export async function requestGanMarkAllRead(fetcher: MarkReadFetcher): Promise<boolean> {
  const response = await fetcher("/api/notifications/mark-read", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
  });
  return response.ok;
}
