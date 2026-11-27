"use client";

import { type MouseEvent } from "react";

const contentId = "dashboard-primary-content";

function primaryMain() {
  const declared = document.getElementById(contentId);
  if (declared?.tagName === "MAIN") return declared;
  return document.querySelector<HTMLElement>("main");
}

function prepareTarget() {
  const target = primaryMain();
  if (!target) return null;
  const previous = document.getElementById(contentId);
  if (previous && previous !== target) previous.removeAttribute("id");
  if (target.id !== contentId) target.id = contentId;
  if (target.tabIndex !== -1) target.tabIndex = -1;
  return target;
}

export function DashboardSkipLink() {
  function skipToMain(event: MouseEvent<HTMLAnchorElement>) {
    const target = prepareTarget();
    if (!target) return;
    event.preventDefault();
    target.focus();
  }

  return <a className="dashboard-skip-link" href={`#${contentId}`} onClick={skipToMain}>דלג לתוכן הראשי</a>;
}
