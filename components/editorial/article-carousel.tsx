"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function ArticleCarousel({ articles }: { articles: { slug: string; title: string; summary: string }[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || articles.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % articles.length), 6500);
    return () => window.clearInterval(timer);
  }, [paused, articles.length]);
  if (!articles.length) return null;
  const article = articles[active];
  return (
    <div className="editorial-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)} aria-label="כתבות מתחלפות">
      <div aria-live="off">
        <span className="editorial-kicker">מגזין גן בטוח · {active + 1} מתוך {articles.length}</span>
        <h3><Link href={`/articles/${article.slug}`}>{article.title}</Link></h3>
        <p>{article.summary}</p>
        <Link className="gb-public-button soft" href={`/articles/${article.slug}`}>לקריאת הכתבה</Link>
      </div>
      <div className="editorial-carousel-controls" aria-label="ניווט כתבות">
        <button type="button" onClick={() => setActive((active - 1 + articles.length) % articles.length)} aria-label="הכתבה הקודמת">‹</button>
        <button type="button" onClick={() => setActive((active + 1) % articles.length)} aria-label="הכתבה הבאה">›</button>
      </div>
    </div>
  );
}
