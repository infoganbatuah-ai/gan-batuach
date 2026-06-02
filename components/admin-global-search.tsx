"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

type Result = { type: string; title: string; subtitle?: string; href: string };

export function AdminGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const body = await response.json();
        setResults(response.ok ? body.data ?? [] : []);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="admin-global-search">
      <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש אדמין: גן, משתמש, ילד, מסמך, משימה..." /></label>
      {query.length >= 2 ? <div className="search-results-panel">{loading ? <span>מחפש...</span> : results.length === 0 ? <span>אין תוצאות</span> : results.map((item, index) => <Link href={item.href} key={`${item.type}-${item.title}-${index}`}><b>{item.type}</b><strong>{item.title}</strong><small>{item.subtitle}</small></Link>)}</div> : null}
    </div>
  );
}
