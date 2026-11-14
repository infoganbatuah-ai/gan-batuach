"use client";

import { useEffect, type MouseEvent } from "react";
import { usePathname } from "next/navigation";

const contentId = "dashboard-primary-content";

function primaryMain() {
  return document.querySelector<HTMLElement>("main");
}

function prepareTarget() {
  const target = primaryMain();
  if (!target) return null;
  const previous = document.getElementById(contentId);
  if (previous && previous !== target) previous.removeAttribute("id");
  target.id = contentId;
  target.tabIndex = -1;
  return target;
}

export function DashboardSkipLink() {
  const pathname = usePathname();

  useEffect(() => {
    const frame = requestAnimationFrame(prepareTarget);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  function skipToMain(event: MouseEvent<HTMLAnchorElement>) {
    const target = prepareTarget();
    if (!target) return;
    event.preventDefault();
    target.focus();
  }

  return <a className="dashboard-skip-link" href={`#${contentId}`} onClick={skipToMain}>דלג לתוכן הראשי</a>;
}
