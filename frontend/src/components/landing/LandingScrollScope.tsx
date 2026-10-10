"use client";

import { useEffect } from "react";

/**
 * Marks the document while the landing page is mounted.
 *
 * `globals.css` hangs the landing-only smooth scrolling and anchor
 * scroll-margin off `html[data-landing="true"]`, so the dashboard and auth
 * routes keep their native scroll behaviour. The attribute is removed on
 * unmount, which matters because client-side navigation to /login or
 * /dashboard never reloads the document.
 */
export function LandingScrollScope() {
  useEffect(() => {
    document.documentElement.setAttribute("data-landing", "true");
    return () => document.documentElement.removeAttribute("data-landing");
  }, []);

  return null;
}
