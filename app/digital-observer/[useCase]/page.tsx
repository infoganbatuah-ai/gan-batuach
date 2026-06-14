import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bell, Camera, PackageCheck, Radar, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { DIGITAL_OBSERVER_USE_CASES } from "@/lib/domain/digital-observer-product";

type PageProps = {
  params: Promise<{ useCase: string }>;
};

function findUseCase(key: string) {
  return DIGITAL_OBSERVER_USE_CASES.find((item) => item.key === key);
}

export function generateStaticParams() {
  return DIGITAL_OBSERVER_USE_CASES.map((item) => ({ useCase: item.key }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { useCase } = await params;
  const item = findUseCase(useCase);
  if (!item) return {};
  return {
    title: `${item.title} – Digital Observer`,
    description: item.solution,
    alternates: { canonical: item.path },
    openGraph: {
      title: `${item.title} – Digital Observer`,
      description: item.solution,
      url: item.path
    }
  };
}

export default async function DigitalObserverUseCasePage({ params }: PageProps) {
  const { useCase } = await params;
  const item = findUseCase(useCase);
  if (!item) notFound();

  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-public">
        <section className="hero-section digital-observer-hero">
          <div className="hero-content">
            <p className="eyebrow">Digital Observer use case</p>
            <h1>{item.title}</h1>
            <p>{item.solution}</p>
            <div className="hero-actions">
              <Link className="button primary" href="/digital-observer/onboarding">Start monitoring <ArrowLeft size={18} /></Link>
              <Link className="button secondary" href="/digital-observer">Digital Observer home</Link>
            </div>
          </div>
          <div className="observer-live-card">
            <strong>{item.packageSuggestion}</strong>
            <span>{item.audience}</span>
            <span>test mode first</span>
            <span>policy-gated capabilities</span>
          </div>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <Radar />
            <h2>Problem</h2>
            <p>{item.problem}</p>
          </article>
          <article className="card action-panel">
            <ShieldCheck />
            <h2>Solution</h2>
            <p>{item.solution}</p>
          </article>
        </section>

        <section className="grid cols-3 dashboard-panels">
          <article className="card compact-card">
            <Camera />
            <h3>Camera setup</h3>
            <p>{item.cameraSetup}</p>
          </article>
          <article className="card compact-card">
            <Bell />
            <h3>Alerts</h3>
            <p>{item.alerts}</p>
          </article>
          <article className="card compact-card">
            <PackageCheck />
            <h3>Package suggestion</h3>
            <p>{item.packageSuggestion}</p>
          </article>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Monitoring benefits</h2>
            <p>Careful launch wording: visibility, alerts and review support without unsupported guarantees.</p>
          </div>
          <div className="setup-checklist">
            {item.benefits.map((benefit) => <span key={benefit}>{benefit}</span>)}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="hero-actions">
            <Link className="button primary" href="/book-demo?product=digital_observer">Request demo</Link>
            <Link className="button secondary" href="/digital-observer/onboarding">Create observer site</Link>
          </div>
        </section>
      </main>
    </>
  );
}
