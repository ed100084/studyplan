"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const PENDING_ATTRIBUTE = "data-nav-pending";

function isPlainLeftClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function clearNavigationPending() {
  document.body.classList.remove("route-pending");
  document.querySelectorAll<HTMLElement>(`[${PENDING_ATTRIBUTE}="true"]`).forEach((element) => {
    element.removeAttribute(PENDING_ATTRIBUTE);
    element.removeAttribute("aria-busy");
  });
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingLabel, setPendingLabel] = useState("載入中...");

  useEffect(() => {
    clearNavigationPending();
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!isPlainLeftClick(event) || event.defaultPrevented) return;

      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-nav-feedback]");
      if (!link || link.target || link.hasAttribute("download")) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const targetUrl = new URL(link.href, window.location.href);
      if (targetUrl.origin !== window.location.origin) return;
      if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) return;

      link.setAttribute(PENDING_ATTRIBUTE, "true");
      link.setAttribute("aria-busy", "true");
      document.body.classList.add("route-pending");
      setPendingLabel(link.dataset.pendingLabel ?? "載入中...");
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return (
    <div className="route-pending-indicator" aria-live="polite" role="status">
      <span className="loading-dot" aria-hidden="true" />
      <span>{pendingLabel}</span>
    </div>
  );
}
