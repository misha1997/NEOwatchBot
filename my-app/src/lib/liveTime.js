// Live time helpers for the homepage blocks: locale-aware date/time formatting
// (Europe/Kyiv timezone, uk/en via i18next), a humanized "через 2 год 14 хв"
// duration, a "T-02:14:36" countdown clock, and ticking <CountdownT>/<RelativeTime>
// components driven by unix-second timestamps (the shape /api/iss/passes and
// /api/launches return: start_utc / net_ts).
import { useEffect, useState } from "react";
import i18next from "../i18n";

const TZ = "Europe/Kyiv";
const locale = () => (i18next.language === "en" ? "en-GB" : "uk-UA");

// iso string OR epoch ms → Date
function asDate(iso) {
  return new Date(iso);
}

export function formatTime(iso) {
  return new Intl.DateTimeFormat(locale(), {
    hour: "2-digit", minute: "2-digit", timeZone: TZ,
  }).format(asDate(iso));
}

export function formatDayShort(iso) {
  return new Intl.DateTimeFormat(locale(), {
    day: "2-digit", month: "2-digit", timeZone: TZ,
  }).format(asDate(iso));
}

export function formatWeekday(iso) {
  return new Intl.DateTimeFormat(locale(), {
    weekday: "long", timeZone: TZ,
  }).format(asDate(iso));
}

// Stable per-day key (YYYY-MM-DD in Kyiv tz) for grouping launches by day.
export function dayKey(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ,
  }).format(asDate(iso));
}

// "через 2 год 14 хв" / "3 дні 4 год" / "5 хвилин" — bare duration, no prefix.
// Returns the i18next "now" key when the target is in the past.
export function humanizeUntil(target, now) {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return i18next.t("liveTime.now");
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  const t = i18next.t.bind(i18next);
  if (days > 0) return `${days} ${t("liveTime.day", { count: days })} ${hours} ${t("liveTime.hrAbbr")}`;
  if (hours > 0) return `${hours} ${t("liveTime.hrAbbr")} ${minutes} ${t("liveTime.minAbbr")}`;
  return `${minutes} ${t("liveTime.min", { count: minutes })}`;
}

// "T-02:14:36" / "T-1д 14:36". Clamped at 0.
export function countdownClock(target, now) {
  const ms = Math.max(0, target.getTime() - now.getTime());
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (v) => String(v).padStart(2, "0");
  if (d > 0) return `T-${d}${i18next.t("liveTime.dAbbr")} ${pad(h)}:${pad(m)}`;
  return `T-${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Ticking "now" — re-renders every `intervalMs`. Initialised synchronously so
// there is no flash of the fallback (this is a client SPA, no hydration).
export function useTick(intervalMs) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// "T-02:14:36" mono countdown. `ts` is unix seconds.
export function CountdownT({ ts, fallback = "T-—", className }) {
  const now = useTick(1000);
  if (!ts) return <span className={className}>{fallback}</span>;
  return <span className={className}>{countdownClock(new Date(ts * 1000), now)}</span>;
}

// "через 2 год 14 хв" (or bare duration with prefix=false). `ts` is unix seconds.
export function RelativeTime({ ts, fallback = "—", prefix = true, className }) {
  const now = useTick(30000);
  if (!ts) return <span className={className}>{fallback}</span>;
  const target = new Date(ts * 1000);
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return <span className={className}>{i18next.t("liveTime.now")}</span>;
  const text = humanizeUntil(target, now);
  return (
    <span className={className}>
      {prefix ? `${i18next.t("liveTime.inPrefix")} ${text}` : text}
    </span>
  );
}