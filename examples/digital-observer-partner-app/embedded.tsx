// Independent embedded example: browser receives only a short-lived, audience-scoped token.
import { DigitalObserverEmbeddedClient } from "../../packages/digital-observer-sdk/src/browser";
import { ActivityFeed, CameraGrid, EmbeddedShell } from "../../packages/digital-observer-sdk/src/react";

export async function PartnerDashboard({ endpoint, token, audience }: { endpoint: string; token: string; audience: string }) {
  const data = await new DigitalObserverEmbeddedClient({ endpoint, token, audience }).dashboard();
  return <EmbeddedShell brand={data.brand}><CameraGrid cameras={data.cameras} /><ActivityFeed title="Events" items={data.events} /></EmbeddedShell>;
}
