// "X online" badge + day/week visitor tallies for the footer's right column.
// Polls /api/online every 30 s — each poll both refreshes the counts and
// heartbeats this visitor so the server keeps them counted. Each stat stays
// a placeholder ("—") until the first successful response, and never throws
// into the footer on a network error.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getOnline } from "../../lib/api";

const POLL_MS = 30000;

export default function OnlineCounter() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({ online: null, day: null, week: null });

  useEffect(() => {
    let alive = true;
    const tick = () =>
      getOnline()
        .then((d) => alive && setStats({ online: d.online, day: d.day, week: d.week }))
        .catch(() => {});
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="site-stats">
      <div className="online-counter" title={t("footer.onlineTip")}>
        <span className="online-dot" />
        <span className="online-count">{stats.online ?? "—"}</span>
        <span>{t("footer.online")}</span>
      </div>
      <div className="visit-stat" title={t("footer.visitorsTodayTip")}>
        <span className="online-count">{stats.day ?? "—"}</span>
        <span>{t("footer.visitorsToday")}</span>
      </div>
      <div className="visit-stat" title={t("footer.visitorsWeekTip")}>
        <span className="online-count">{stats.week ?? "—"}</span>
        <span>{t("footer.visitorsWeek")}</span>
      </div>
    </div>
  );
}