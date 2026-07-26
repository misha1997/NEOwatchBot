// Homepage "Календар стартів тижня" — port of the orbit-light LaunchCalendar.
// Launches grouped by day (dayKey over net_ts), each group with a day header
// (date + weekday + count) and one row per launch: time + live T- countdown,
// mission, rocket & pad, country, status chip. Live data from /api/launches.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getLaunches } from "../../lib/api";
import { dayKey, formatDayShort, formatTime, formatWeekday, CountdownT } from "../../lib/liveTime";

function StatusChip({ label, cls }) {
  if (cls === "gold") {
    return (
      <span className="status-chip go">
        <span className="status-dot" aria-hidden="true" />
        {label}
      </span>
    );
  }
  if (cls === "teal") {
    return <span className="status-chip success">{label}</span>;
  }
  if (cls === "coral") {
    return <span className="status-chip fail">{label}</span>;
  }
  return <span className="status-chip"><span className="status-dot dim" aria-hidden="true" />{label}</span>;
}

function countWord(n, t) {
  return t("home.launches.count", { count: n });
}

function groupByDay(items) {
  const map = new Map();
  for (const l of items) {
    if (!l.net_ts) continue;
    const key = dayKey(l.net_ts * 1000);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(l);
  }
  return [...map.entries()];
}

export default function LaunchCalendar() {
  const { t } = useTranslation();
  const { data } = useApi(getLaunches);

  const placeholders = [
    { date: "05.07 · 17:31", net_ts: null, name: "Crew-11", rocket: "Falcon 9 Block 5", pad: t("launches.ph.pad1"), country: t("launches.country.usa"), status_label: "Go", status_class: "gold" },
    { date: "07.07 · 11:12", net_ts: null, name: "Starlink Group 12-8", rocket: "Falcon 9 Block 5", pad: t("launches.ph.pad2"), country: t("launches.country.usa"), status_label: "Go", status_class: "gold" },
    { date: "10.07 · 00:00", net_ts: null, name: "Galileo L13", rocket: "Ariane 6", pad: t("launches.ph.pad3"), country: t("launches.country.eu"), status_label: "TBD", status_class: "" },
    { date: "12.07 · 06:45", net_ts: null, name: "BlackSky Gen-3", rocket: "Electron", pad: t("launches.ph.pad4"), country: t("launches.country.nz"), status_label: "Go", status_class: "gold" },
    { date: "15.07 · 19:20", net_ts: null, name: "Shijian-26", rocket: "Long March 3B", pad: t("launches.ph.pad5"), country: t("launches.country.cn"), status_label: "TBD", status_class: "" },
  ];

  const items = (data && data.items) || placeholders;
  const days = groupByDay(items);
  const hasNet = days.length > 0;

  // No net_ts yet (placeholders / fallback) → render a flat list.
  if (!hasNet) {
    return (
      <div className="lc-cal">
        <ul className="lc-rows">
          {items.map((l, i) => (
            <li key={i} className="lc-row">
              <div className="lc-time-col">
                <span className="lc-time tabular">{l.date}</span>
              </div>
              <div className="lc-mission">
                <h4>{l.name}</h4>
                <div className="lc-sub mono">
                  <span className="lc-rocket">🚀 {l.rocket}</span>
                  <span className="lc-pad">📍 {l.pad}</span>
                </div>
              </div>
              <div className="lc-end">
                <span className="lc-country mono">{l.country}</span>
                <StatusChip label={l.status_label} cls={l.status_class} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="lc-cal">
      {days.map(([key, list]) => (
        <div key={key} className="lc-day">
          <div className="lc-day-head">
            <span className="lc-day-date tabular">{formatDayShort(list[0].net_ts * 1000)}</span>
            <span className="lc-day-weekday">{formatWeekday(list[0].net_ts * 1000)}</span>
            <span className="lc-day-line" aria-hidden="true" />
            <span className="lc-day-count mono">{list.length} {countWord(list.length, t)}</span>
          </div>
          <ul className="lc-rows">
            {list.map((l, i) => (
              <li key={i} className="lc-row">
                <div className="lc-time-col">
                  <span className="lc-time tabular">{formatTime(l.net_ts * 1000)}</span>
                  <CountdownT ts={l.net_ts} fallback="T-—" className="lc-countdown mono" />
                </div>
                <div className="lc-mission">
                  <h4>{l.name}</h4>
                  <div className="lc-sub mono">
                    <span className="lc-rocket">🚀 {l.rocket}</span>
                    <span className="lc-pad">📍 {l.pad}</span>
                  </div>
                </div>
                <div className="lc-end">
                  <span className="lc-country mono">{l.country}</span>
                  <StatusChip label={l.status_label} cls={l.status_class} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}