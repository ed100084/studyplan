"use client";

import { useEffect } from "react";
import { DEFAULT_TIME_ZONE, TIME_ZONE_COOKIE } from "@/lib/timezone-constants";

export function TimeZoneSync() {
  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
    const currentValue = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith(`${TIME_ZONE_COOKIE}=`))
      ?.split("=")[1];

    if (decodeURIComponent(currentValue ?? "") === timeZone) {
      return;
    }

    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}; Path=/; Max-Age=31536000; SameSite=Lax`;

    if (currentValue || timeZone !== DEFAULT_TIME_ZONE) {
      window.location.reload();
    }
  }, []);

  return null;
}
