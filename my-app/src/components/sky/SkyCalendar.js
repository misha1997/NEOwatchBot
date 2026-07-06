// Weekly sky calendar (sky.html #sky-calendar). Unified, date-sorted timeline
// of the next ~7 days built from ISS passes, rocket launches and Moon phases.
// Port of app.js loadSkyCalendar.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLoc } from "../../context/LocationContext";
import i18next from "../../i18n";
import { getIssPasses, getLaunches, getMoon } from "../../lib/api";

const WEEK = 7 * 86400000;

function fmtTs(ts) {
  try {
    const locale = i18next.language === "en" ? "en-US" : "uk-UA";
    return new Date(ts).toLocaleString(locale, {
      timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).replace(", ", " · ");
  } catch {
    return "—";
  }
}

function issEvents(data, t) {
  return ((data && data.items) || []).map((p) => ({
    ts: (p.start_utc || 0) * 1000, date: p.start,
    pill: t("sky.calendar.issPill"), cls: "gold", title: t("sky.calendar.issTitle"),
    detail: t("sky.calendar.issDetail", {
      el: p.max_el, from: p.from_dir, to: p.to_dir,
      dur: Math.round((p.duration_sec || 0) / 60),
    }),
  }));
}
function launchEvents(data) {
  return ((data && data.items) || []).map((l) => ({
    ts: (l.net_ts || 0) * 1000, date: l.date,
    pill: l.status_label || "TBD", cls: l.status_class || "",
    title: l.name, detail: (l.rocket || "—") + " · " + (l.pad || "—"),
  }));
}
function moonEvents(m, now, t) {
  if (!m) return [];
  const out = [];
  if (m.days_to_new != null) {
    const ts = now + m.days_to_new * 86400000;
    out.push({ ts, date: fmtTs(ts), pill: t("sky.calendar.moonPill"), cls: "teal", title: t("sky.calendar.newMoonTitle"), detail: t("sky.calendar.newMoonDetail") });
  }
  if (m.days_to_full != null) {
    const ts = now + m.days_to_full * 86400000;
    out.push({ ts, date: fmtTs(ts), pill: t("sky.calendar.moonPill"), cls: "gold", title: t("sky.calendar.fullMoonTitle"), detail: t("sky.calendar.fullMoonDetail") });
  }
  return out;
}

export default function SkyCalendar({ lang }) {
  const { t } = useTranslation();
  const { loc } = useLoc();
  const [evs, setEvs] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      getIssPasses(loc, lang).then((d) => issEvents(d, t)).catch(() => []),
      getLaunches().then(launchEvents).catch(() => []),
      getMoon(lang).then((m) => moonEvents(m, Date.now(), t)).catch(() => []),
    ]).then((r) => {
      if (!alive) return;
      const now = Date.now();
      const all = r[0].concat(r[1], r[2])
        .filter((e) => e.ts && e.ts >= now - 3600000 && e.ts <= now + WEEK)
        .sort((a, b) => a.ts - b.ts)
        .slice(0, 6);
      setEvs(all);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc && loc.lat, loc && loc.lon, lang, t]);

  if (!evs) {
    return (
      <div className="grid cols-3" id="sky-calendar">
        <div className="card">
          <div className="k">{t("sky.calendar.loading")}</div>
          <h4 style={{ fontSize: 15.5, marginTop: 12, fontWeight: 600 }}>{t("sky.calendar.title")}</h4>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 6 }}>{t("sky.calendar.sub")}</p>
        </div>
      </div>
    );
  }
  if (evs.length === 0) {
    return (
      <div className="grid cols-3" id="sky-calendar">
        <div className="card">
          <div className="k">{t("sky.calendar.soon")}</div>
          <h4 style={{ fontSize: 15.5, marginTop: 12, fontWeight: 600 }}>{t("sky.calendar.noEvents")}</h4>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 6 }}>{t("sky.calendar.retry")}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="grid cols-3" id="sky-calendar">
      {evs.map((e, i) => (
        <div className="card" key={i}>
          <div className="k">{e.date} <span className={"pill " + e.cls}>{e.pill}</span></div>
          <h4 style={{ fontSize: 15.5, marginTop: 12, fontWeight: 600 }}>{e.title}</h4>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 6 }}>{e.detail}</p>
        </div>
      ))}
    </div>
  );
}