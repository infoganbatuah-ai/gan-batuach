import type { CSSProperties, ReactNode } from "react";

export type PartnerBrand = { product_name: string; brand_name: string; logo_url?: string | null; primary_color: string; accent_color: string; legally_required_notices?: string[] };
export function EmbeddedShell({ brand, children }: { brand: PartnerBrand; children: ReactNode }) {
  const style = { "--partner-primary": brand.primary_color, "--partner-accent": brand.accent_color } as CSSProperties;
  return <section data-partner-embedded style={style} aria-label={brand.product_name}><header>{brand.logo_url ? <img src={brand.logo_url} alt="" /> : null}<strong>{brand.product_name}</strong><small>{brand.brand_name}</small></header>{children}<footer>{brand.legally_required_notices?.map((notice) => <small key={notice}>{notice}</small>)}</footer></section>;
}
export function CameraGrid({ cameras }: { cameras: Array<{ id: string; display_name: string; health_status: string }> }) {
  return <div role="list" aria-label="Cameras">{cameras.map((camera) => <article role="listitem" key={camera.id}><strong>{camera.display_name}</strong><span>{camera.health_status}</span></article>)}</div>;
}
export function ActivityFeed({ title, items }: { title: string; items: Array<{ id: string; title?: string; status?: string; created_at?: string }> }) {
  return <section><h2>{title}</h2><ol>{items.map((item) => <li key={item.id}><strong>{item.title ?? item.id}</strong><span>{item.status ?? "available"}</span></li>)}</ol></section>;
}
